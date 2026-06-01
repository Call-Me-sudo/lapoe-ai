
-- 1) Per-bot webhook secret (used as Telegram's X-Telegram-Bot-Api-Secret-Token)
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS webhook_secret text NOT NULL
  DEFAULT encode(gen_random_bytes(32), 'hex');

-- 2) Verified-update queue (written by edge function, processed by worker)
CREATE TABLE IF NOT EXISTS public.telegram_update_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  telegram_update_id bigint NOT NULL,
  chat_id text,
  raw_update jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, telegram_update_id)
);

CREATE INDEX IF NOT EXISTS idx_tg_queue_unprocessed
  ON public.telegram_update_queue (bot_id, created_at)
  WHERE processed_at IS NULL;

GRANT ALL ON public.telegram_update_queue TO service_role;
ALTER TABLE public.telegram_update_queue ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated grants: this table is service-role only.
