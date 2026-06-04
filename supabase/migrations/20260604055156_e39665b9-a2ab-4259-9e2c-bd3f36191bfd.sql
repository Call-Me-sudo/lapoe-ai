-- 1) Track when each bot's Telegram webhook was last registered so the worker
-- can self-heal bots that have a token but were never registered.
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS webhook_registered_at timestamptz;

-- 2) Trigger: as soon as a webhook update lands in the queue, ping
-- telegram-poll with the specific bot_id so it drains that bot immediately.
-- The worker is idempotent (rows are claimed by setting processed_at) so
-- multiple triggers landing at once are fine.
CREATE OR REPLACE FUNCTION public.notify_telegram_queue_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://pyseodaurcbggatqswtw.supabase.co/functions/v1/telegram-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2VvZGF1cmNiZ2dhdHFzd3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTM2MjgsImV4cCI6MjA5Mjk4OTYyOH0.tFJ0SzUMnlhUEjzGXI3ci8OXHHepbEHVViCG5RZEvV4'
    ),
    body := jsonb_build_object('mode', 'queue', 'bot_id', NEW.bot_id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the webhook ack just because the dispatch failed; the cron
  -- fallback will pick it up within a minute.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_telegram_queue_dispatch ON public.telegram_update_queue;
CREATE TRIGGER trg_telegram_queue_dispatch
  AFTER INSERT ON public.telegram_update_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_telegram_queue_insert();