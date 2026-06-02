# LaPoe — Developer Guide

> Read this before touching the Telegram bot code. There are policy rules here that the product depends on.

---

## What LaPoe is

LaPoe is a multi-tenant Telegram assistant platform. Two kinds of bots run on it:

1. **User bots** — Telegram bots created by end users via [@BotFather](https://t.me/BotFather). Each user pastes their bot token into the dashboard. LaPoe polls Telegram (`getUpdates`) for these bots and replies on the user's behalf using their knowledge base, persona, and house rules.
2. **The system bot (`@LaPoe_bot`)** — A single shared, general-purpose group bot (think Rose). Anyone can add it to a Telegram group. It also doubles as the **control center** for LaPoe accounts: linked users can manage their own user bots from here.

Everything is one repo. The web dashboard, the polling worker, and the system bot all live in the same Supabase project.

---

## Architecture

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| Auth + DB + Storage | Supabase (provisioned through Lovable Cloud) |
| Edge functions | Supabase Edge Functions, Deno runtime |
| AI | Lovable AI Gateway (`google/gemini-3-flash-preview` for chat, `text-embedding-004` for embeddings) |
| Retrieval | Postgres full-text search via `match_knowledge_chunks_text` RPC |
| Payments | Stripe |
| Telegram | Long-polling (`getUpdates`) for user bots, `pg_cron`-triggered every minute |

### Key edge functions

| Function | Purpose |
|---|---|
| `telegram-poll` | Polls every user bot, runs moderation + AI replies |
| `lapoe-system-bot` | Handles `@LaPoe_bot` updates — group features + account control |
| `index-knowledge` | Chunks + indexes knowledge sources |
| `bot-playground` | Test-rig that lets owners chat with their bot in the dashboard |
| `telegram-link-init` / `generate-link-code` | Account ↔ Telegram linking |
| `refresh-group-names` | Background refresh of group metadata |
| `stripe-checkout` / `stripe-portal` | Billing |

### Key tables

`bots`, `knowledge_sources`, `knowledge_chunks`, `telegram_groups`, `bot_messages`, `moderation_actions`, `unanswered_questions`, `bot_feedback`, `system_bot_groups`, `system_bot_warnings`, `system_bot_filters`, `system_bot_notes`, `system_bot_mod_log`, `profiles`, `user_roles`, `subscriptions`, `monthly_usage`.

---

## 🚫 Bot DM policy — do NOT change this

**A user-created bot must never accept owner/configuration commands in its own DMs. Not even from the verified owner.**

In practice this means:

- `supabase/functions/telegram-poll/index.ts` → `handleDmGeneral` only accepts:
  - `/start`, `/help` → friendly intro
  - `/feedback <text>` → stored in `bot_feedback`
  - `/donate` → support the bot owner (coming soon)
- Any legacy owner command (`/settone`, `/setrules`, `/addknow`, `/banword`, …) sent in DM is explicitly rejected with a pointer to the dashboard or `@LaPoe_bot`.
- The bot does **not** branch its `/start` reply based on whether the sender is the owner. DMs look the same to everyone.

### Why

1. **No leakage.** If owner commands worked in DM, strangers messaging the bot would see hints like "🔒 only the owner can do this", which leaks the existence of admin surface area and invites probing.
2. **No self-replies / loops.** Earlier bugs let bots respond to themselves, since "owner DM" looked indistinguishable from a self-message in some flows. Banning all config from DMs eliminates the class.
3. **One source of truth.** Configuration belongs in the dashboard (audited, multi-device, versioned) or via `@LaPoe_bot` (which authenticates the Telegram user against a linked profile and runs in its own well-defined surface). A user bot's DM is a customer-facing surface — keep it that way.
4. **Plan safety.** Configuration via DM bypassed several quota and audit paths. The dashboard and `@LaPoe_bot` both enforce them.

### Where to add config commands instead

- **Dashboard** (`src/pages/dashboard/Bots.tsx`, `Knowledge.tsx`, `Settings.tsx`, etc.) — the canonical place.
- **System bot** (`supabase/functions/lapoe-system-bot/index.ts`) — for users who prefer Telegram. The system bot already verifies the Telegram user against `profiles.telegram_user_id` via `/link`.

If you find yourself reaching for "let me add a `/setX` to the user bot DM," stop. Add it to one of the two surfaces above.

---

## General commands user bots DO support in DM

Keep this list short and product-defined. As of today:

| Command | Behaviour |
|---|---|
| `/start` | Friendly intro + pointer to `https://lapoe.app` |
| `/help` | Same intro |
| `/feedback <message>` | Inserts into `bot_feedback`. Owners read it in their dashboard. |
| `/donate` | Support the bot owner (coming soon) |

Anything else in DM falls through to AI chat (with the bot's persona, knowledge, and quota), or the explicit "I don't take configuration in DMs" reply for known legacy admin commands.

---

## Groups

In groups, user bots:

- Auto-register the group on first message (`telegram_groups`).
- Reply when mentioned, replied-to, greeted, asked a question that matches knowledge, or named.
- Run moderation if `bot.moderation_enabled` is true: anti-spam, anti-flood, banned words.
- Accept moderation commands (`/ban /unban /kick /mute /unmute /del /pin /unpin /warn`) **only from group admins or the linked bot owner**.

The system bot (`@LaPoe_bot`) in groups exposes the full Rose-style suite (rules, welcomes, filters, notes, warns, locks, …). See `supabase/functions/lapoe-system-bot/index.ts`.

---

## Local conventions

- **Never** edit `src/integrations/supabase/client.ts` or `types.ts` — auto-generated.
- All colours and spacing go through the design tokens in `src/index.css` + `tailwind.config.ts`. No raw hex in components.
- Migrations: every `CREATE TABLE public.<x>` must be followed by `GRANT`s before `ENABLE ROW LEVEL SECURITY`.
- Role checks must go through the `has_role(uid, 'owner')` SECURITY DEFINER function — never read roles from the client and never store role on `profiles`.
- AI calls go through the Lovable AI Gateway (`LOVABLE_API_KEY`). No third-party AI keys.

---

## Running

The dashboard is a standard Vite app. Edge functions deploy automatically on push. Telegram polling for user bots is driven by `pg_cron` (every minute → `telegram-poll`) and for the system bot (every minute → `lapoe-system-bot`). No persistent server.

---

## Adding a new bot DM command? Read this first

Open this file again. Re-read **"Bot DM policy"**. If your new command would let the owner change *anything* on the bot from DM — stop. Put it in the dashboard or in `@LaPoe_bot`.
