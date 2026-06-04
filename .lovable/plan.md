## Why the bots feel slow

Your Vercel deployment only serves the dashboard website — it has nothing to do with bot latency. The bots themselves run entirely on Lovable Cloud (Supabase Edge Functions), so Vercel is not the bottleneck and moving off it would not help.

The real cause is in `supabase/functions/telegram-poll/index.ts`. Right now every user bot is checked on a **1-minute `pg_cron` schedule** using Telegram's `getUpdates` long-polling API. That means:

- A message lands in Telegram → it can sit up to **~60 seconds** before the next cron tick picks it up.
- The first message after an idle period also pays a **cold-start** cost on top, because the function has to boot before it polls.
- Every bot is polled every minute even when nobody messaged it — wasted work, and it blocks the worker from being more responsive to the bots that *are* active.

Telegram itself supports a much faster delivery mode: **webhooks**. Telegram pushes each update to our endpoint within milliseconds of the user sending it. We already have most of the plumbing for this — `supabase/functions/telegram-webhook/index.ts` exists, verifies the per-bot `webhook_secret`, rate-limits abuse, and writes updates into `telegram_update_queue`. It's just not wired up end-to-end.

## The plan

Move user bots from cron polling to Telegram-push webhooks, with the existing `telegram-poll` worker kept only as a safety net.

### 1. Finish the webhook → worker path

- Add a tiny dispatcher that drains `telegram_update_queue` the moment a row is inserted (Postgres `LISTEN/NOTIFY` via Supabase Realtime, or a `pg_net` HTTP call from an `AFTER INSERT` trigger that pings `telegram-poll` with a `?process_queue=<bot_id>` flag).
- Refactor `telegram-poll` so its message-handling logic can be invoked in two modes:
  - **queue mode** (new, default): given a `bot_id`, drain queued updates for that bot from `telegram_update_queue` and run the existing moderation + AI reply logic on each one.
  - **legacy poll mode** (kept): the current `getUpdates` loop, used only as a fallback.
- Acknowledge + delete each queue row after processing so retries are idempotent.

### 2. Register webhooks for each user bot

- On bot creation / token update in `src/pages/dashboard/Bots.tsx` (and the matching server path), call Telegram's `setWebhook` for that bot's token:
  - `url = https://<project>.functions.supabase.co/telegram-webhook?bot_id=<UUID>`
  - `secret_token = bots.webhook_secret` (generate if missing)
  - `allowed_updates = ["message","edited_message","callback_query"]`
- Add a one-off backfill script/edge action that loops existing rows in `bots` and registers webhooks for any bot that still has none. Surface a "Webhook: ✅ active / ⚠️ not registered" badge in the dashboard so you can see the state.
- On bot pause/delete, call `deleteWebhook` to keep Telegram clean.

### 3. Reduce cold-start latency

- Lower `pg_cron` frequency for `telegram-poll` from every minute to every 5 minutes — it now only exists as a safety net to catch bots whose webhook somehow got unregistered. This is cheaper *and* keeps the worker warm enough that the rare fallback is still fast.
- Add a lightweight `health-ping` cron (every 1–2 minutes) that hits both `telegram-webhook` and `telegram-poll` with a no-op request. Keeping the functions warm removes most of the boot delay you feel "before waking".
- Inside `telegram-webhook`, return `200 OK` to Telegram **immediately** after enqueueing — never wait on AI/DB writes. (It already does this; we'll double-check there's no accidental `await` on heavy work in the hot path.)

### 4. Keep the system bot (`@LaPoe_bot`) on its own path

`lapoe-system-bot` is a single shared bot and is fine to keep on cron, but we'll apply the same warm-ping trick to it so group commands feel snappy too.

### 5. Verify

- Add basic timing logs (`queued_at` vs `processed_at`) so we can confirm end-to-end latency drops from "up to 60s" to "well under a second" in the logs.
- Manually send a few test messages to a user bot and a group bot after the switch and check the logs + the dashboard live log.

## Expected result

- New messages get a reply in **< 1 second** in the normal case, instead of "up to a minute".
- No more "the bot is asleep" feeling after idle periods, because the warm-ping keeps the function hot and Telegram pushes work to us instead of us pulling.
- Lower Lovable Cloud usage — we stop polling silent bots every minute.

## Technical details

- Files touched:
  - `supabase/functions/telegram-poll/index.ts` — add queue-drain mode, keep legacy poll as fallback.
  - `supabase/functions/telegram-webhook/index.ts` — confirm fast-ack, add a `NOTIFY` after enqueue.
  - `supabase/config.toml` — already has `verify_jwt = false` for both; no change needed.
  - `src/pages/dashboard/Bots.tsx` (+ matching server path) — register/delete webhook on token save / bot delete; show webhook status badge.
  - New migration: lower `telegram-poll` cron to `*/5 * * * *`, add `*/2 * * * *` warm-ping cron, optional `AFTER INSERT` trigger on `telegram_update_queue` that calls the worker via `pg_net`.
- No new tables required — `telegram_update_queue` and `bots.webhook_secret` already exist.
- No Vercel changes. Vercel only hosts the dashboard; bot traffic never touches it.

## Question before I build

Do you want me to **migrate all existing user bots automatically** to webhooks on the next deploy (recommended — they'll just start responding faster), or **gate it behind a per-bot toggle** in the dashboard so you can flip bots over one at a time?