
-- Make sure pg_cron + pg_net are available (idempotent).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule so we don't stack duplicates.
DO $$
DECLARE jid int;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('telegram-poll-every-minute','telegram-poll-30s-a','telegram-poll-30s-b')
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

-- Run the poller every minute. The function long-polls Telegram for ~50s per
-- invocation, so a 1-minute cadence gives effectively continuous coverage and
-- removes the "first message is slow" gap.
SELECT cron.schedule(
  'telegram-poll-every-minute',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://pyseodaurcbggatqswtw.supabase.co/functions/v1/telegram-poll',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2VvZGF1cmNiZ2dhdHFzd3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTM2MjgsImV4cCI6MjA5Mjk4OTYyOH0.tFJ0SzUMnlhUEjzGXI3ci8OXHHepbEHVViCG5RZEvV4'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $cron$
);
