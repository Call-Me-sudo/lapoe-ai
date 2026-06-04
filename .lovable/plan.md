# Free-Plan Rework + System Bot AI

## 1. Plan limits (DB migration)

Update `plan_limits()`:
- `free`: `max_bots=0`, `max_monthly_messages=30`, `max_groups=1` (so they can still add @LaPoe_bot to one group).
- `starter`/`pro`/`business`: unchanged.

Semantics shift: `max_monthly_messages` for free = AI replies only (commands don't count). For paid users it stays as today (all outbound). Implement this by only calling `increment_monthly_usage` for AI-generated outbound, controlled by `bot_messages.kind` or a new `is_ai` flag.

Add column `bot_messages.is_ai boolean default false`. `increment_monthly_usage` trigger updated to require `direction='outbound' AND (is_ai OR owner_plan != 'free')`. Helper function `should_count_message(owner_id, is_ai)` keeps logic in SQL.

## 2. Delete existing free-user bots

One-time migration:
```sql
DELETE FROM public.bots
WHERE owner_id IN (
  SELECT id FROM auth.users u
  WHERE public.user_plan(u.id) = 'free'
);
```
Cascade removes their groups/rules/knowledge_sources/etc per existing FKs. Insert a notification per affected owner explaining their bot was removed because the free plan no longer allows custom bots, with a link to /pricing.

## 3. Per-user system-bot persona + knowledge

New table `system_bot_personas`:
- `owner_id` (PK, fk profiles.id)
- `display_name` (defaults to profile name)
- `tone` (enum same as bots: friendly/professional/witty/strict/hype)
- `personality` (text, 500 chars)
- `welcome_message` (text)
- `house_rules` (text, optional)
- `created_at`/`updated_at`

Reuse existing `knowledge_sources` + `knowledge_chunks`. Add a sentinel `bot_id = '00000000-0000-0000-0000-000000000000'` per owner (or make `bot_id` nullable when `owner_id` is set + a `scope='system_bot'` flag). Cleaner option: add nullable `system_bot bool` to knowledge_sources; when true, `bot_id` is ignored and chunks are scoped by owner_id. The RAG function gets a sibling `match_knowledge_chunks_text_owner(_owner_id, _query, _match_count)`.

RLS: owner can CRUD their own persona/knowledge.

## 4. Dashboard UI for free users

New page `src/pages/dashboard/MyAssistant.tsx` (only visible when plan = free, or always with a "Free plan AI assistant" label):
- Persona form (name, tone, personality, welcome).
- Reuse Knowledge page — when free plan, the Knowledge upload form writes to the system-bot scope automatically.
- A "Connect Telegram" CTA showing their existing link code (reuse `telegram-link-init` + `telegram_link_codes`).
- Usage bar: X / 30 AI replies this month.

Bots page: when free, replace "New bot" CTA with a card "Free plan uses our shared AI assistant @LaPoe_bot — configure it here →" linking to MyAssistant. Keep upgrade CTA.

## 5. lapoe-system-bot edge function

Currently handles commands + moderation only. Extend:

**Identify owner**: every incoming Telegram message has `from.id`. Look up `profiles.telegram_user_id` (already populated by link flow) → that's the `owner_id`.

**Routing**:
- Commands (`/start`, `/help`, `/feedback`, `/donate`, `/link`, owner-only mod commands in groups): existing behavior, no AI, never counts toward quota.
- DM with non-command text from a linked free user → AI reply with their persona+knowledge, count toward their `monthly_usage`.
- Group message where bot is mentioned/replied-to AND the group is owned (via `system_bot_groups`) by a linked free user → same AI reply path, count toward that owner's quota.
- Unlinked user DMs non-command → reply: "Hey! I'm LaPoe. Link your account at https://lapoe-ai.vercel.app to get your own AI assistant. Try /help."
- Paid user (starter+) sending a DM → polite "You're on a paid plan — use your own bot. Manage at /dashboard/bots."

**Quota check** before calling AI:
```ts
const usage = await rpc('bot_usage_status_owner', { owner_id });
if (usage.monthly_messages >= usage.max_monthly_messages) {
  reply("You've used your 30 free AI replies this month. Commands still work; AI resumes on the 1st. Upgrade: https://lapoe-ai.vercel.app/pricing");
  return; // not counted
}
```

**AI call**: same Lovable AI Gateway, `google/gemini-3.5-flash`, with system prompt built from persona + RAG chunks from `match_knowledge_chunks_text_owner`. Insert `bot_messages` row with `is_ai=true` so the trigger increments usage.

## 6. Uniqueness story

Each free user's bot feels unique because:
- Their persona+tone+personality controls voice.
- Their uploaded knowledge controls answers.
- Their welcome message greets their group members.
- Their display name appears in replies ("— LaPoe for {DisplayName}").

Same `@LaPoe_bot` username, but the brain is theirs. Marketing benefit: every reply still carries `t.me/LaPoe_bot` attribution.

## 7. Cron / warm-ping / webhook architecture

Unchanged. `lapoe-system-bot` already webhook-driven. Just heavier logic path.

## 8. Files touched

- `supabase/migrations/*.sql` (limits, delete bots, system_bot_personas, knowledge scope flag, RPC helpers, bot_messages.is_ai)
- `supabase/functions/lapoe-system-bot/index.ts` (AI routing + quota + RAG)
- `supabase/functions/telegram-poll/index.ts` (skip AI usage counter for non-AI messages on paid plans only if scope shift required — minimal change)
- `src/pages/dashboard/MyAssistant.tsx` (new)
- `src/pages/dashboard/Bots.tsx` (free-plan empty state)
- `src/pages/dashboard/Knowledge.tsx` (route to system-bot scope when plan=free)
- `src/components/DashboardLayout.tsx` (nav item: "My Assistant" for free users)
- `src/pages/Pricing.tsx` (update free-tier copy: "30 AI messages/mo via @LaPoe_bot, no custom bot")

## 9. Out of scope

- No change to paid-plan bots, telegram-poll user-bot path, group reply triggers (locked per memory), or the brand-icon rule.
- No auth/Google changes.
- DM policy for `@LaPoe_bot` will diverge from user-bot DM policy (the user-bot DM lockdown stays exactly as it is in telegram-poll). I'll note this in memory after shipping.

## Quick sanity check questions

If any of these are wrong, tell me before I build:
1. Free user's group: bot needs to be ADMIN in that group, same as paid bots — OK?
2. When a free user upgrades to starter, do we auto-keep their system-bot persona/knowledge as a starting point for their first real bot? (Default: no, fresh start; they can copy manually.)
3. "30 AI replies" — is that per-owner regardless of how many groups/DMs, or per-group? (Default: per-owner total.)
