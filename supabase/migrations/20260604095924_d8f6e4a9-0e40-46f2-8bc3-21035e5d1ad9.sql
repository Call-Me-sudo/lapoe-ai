
-- Drop legacy / duplicate cron jobs
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN SELECT jobid, jobname FROM cron.job WHERE jobname IN (
    'poll-telegram-updates',
    'poll-kade-system-bot',
    'telegram-poll-every-minute',
    'lapoe-system-bot-every-minute',
    'lapoe-bots-warm-ping'
  ) LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- Safety-net cron: every 5 minutes. Re-registers webhook + drains any
-- leftover queued updates the trigger ping might have missed.
SELECT cron.schedule(
  'telegram-poll-every-5min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pyseodaurcbggatqswtw.supabase.co/functions/v1/telegram-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2VvZGF1cmNiZ2dhdHFzd3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTM2MjgsImV4cCI6MjA5Mjk4OTYyOH0.tFJ0SzUMnlhUEjzGXI3ci8OXHHepbEHVViCG5RZEvV4'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- LaPoe system bot safety-net: every 5 minutes. Self-heals the webhook
-- registration with Telegram (idempotent — no-op when already registered).
SELECT cron.schedule(
  'lapoe-system-bot-every-5min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pyseodaurcbggatqswtw.supabase.co/functions/v1/lapoe-system-bot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2VvZGF1cmNiZ2dhdHFzd3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTM2MjgsImV4cCI6MjA5Mjk4OTYyOH0.tFJ0SzUMnlhUEjzGXI3ci8OXHHepbEHVViCG5RZEvV4'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- Warm-ping every 2 minutes: keeps both edge functions hot so the first
-- message after an idle period doesn't pay a cold-start cost.
SELECT cron.schedule(
  'lapoe-warm-ping',
  '*/2 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pyseodaurcbggatqswtw.supabase.co/functions/v1/lapoe-system-bot?action=ping',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  SELECT net.http_post(
    url := 'https://pyseodaurcbggatqswtw.supabase.co/functions/v1/telegram-poll?action=ping',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2VvZGF1cmNiZ2dhdHFzd3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTM2MjgsImV4cCI6MjA5Mjk4OTYyOH0.tFJ0SzUMnlhUEjzGXI3ci8OXHHepbEHVViCG5RZEvV4'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
