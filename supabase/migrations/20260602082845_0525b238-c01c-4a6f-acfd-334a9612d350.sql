
-- 1) Unlink all telegram accounts
UPDATE public.profiles SET telegram_user_id = NULL, telegram_username = NULL, telegram_first_name = NULL, telegram_photo_url = NULL;

-- 2) Reset system bot offset
UPDATE public.system_bot_state SET update_offset = 0, updated_at = now() WHERE id = 1;
INSERT INTO public.system_bot_state (id, update_offset) SELECT 1, 0 WHERE NOT EXISTS (SELECT 1 FROM public.system_bot_state WHERE id = 1);

-- 3) Schedule system bot polling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE jid int;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('lapoe-system-bot-every-minute','kade-system-bot-every-minute')
  LOOP PERFORM cron.unschedule(jid); END LOOP;
END $$;

SELECT cron.schedule(
  'lapoe-system-bot-every-minute',
  '* * * * *',
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

-- 4) Groups table
CREATE TABLE IF NOT EXISTS public.system_bot_groups (
  chat_id bigint PRIMARY KEY,
  title text,
  type text,
  added_by_tg bigint,
  language text NOT NULL DEFAULT 'en',
  welcome_message text,
  goodbye_message text,
  rules text,
  moderation_enabled boolean NOT NULL DEFAULT true,
  anti_flood_enabled boolean NOT NULL DEFAULT true,
  flood_limit int NOT NULL DEFAULT 8,
  captcha_enabled boolean NOT NULL DEFAULT false,
  banned_words text[] NOT NULL DEFAULT '{}',
  warn_limit int NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_bot_groups TO authenticated;
GRANT ALL ON public.system_bot_groups TO service_role;
ALTER TABLE public.system_bot_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view system bot groups" ON public.system_bot_groups
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners manage system bot groups" ON public.system_bot_groups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

-- 5) Warnings
CREATE TABLE IF NOT EXISTS public.system_bot_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  user_id bigint NOT NULL,
  username text,
  reason text,
  issued_by bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sbw_chat_user ON public.system_bot_warnings(chat_id, user_id);
GRANT SELECT ON public.system_bot_warnings TO authenticated;
GRANT ALL ON public.system_bot_warnings TO service_role;
ALTER TABLE public.system_bot_warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view warnings" ON public.system_bot_warnings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'::app_role));

-- 6) Filters
CREATE TABLE IF NOT EXISTS public.system_bot_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  keyword text NOT NULL,
  reply text NOT NULL,
  created_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, keyword)
);
GRANT SELECT ON public.system_bot_filters TO authenticated;
GRANT ALL ON public.system_bot_filters TO service_role;
ALTER TABLE public.system_bot_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view filters" ON public.system_bot_filters
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'::app_role));

-- 7) Notes
CREATE TABLE IF NOT EXISTS public.system_bot_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  name text NOT NULL,
  content text NOT NULL,
  created_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, name)
);
GRANT SELECT ON public.system_bot_notes TO authenticated;
GRANT ALL ON public.system_bot_notes TO service_role;
ALTER TABLE public.system_bot_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view notes" ON public.system_bot_notes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'::app_role));

-- 8) Moderation log
CREATE TABLE IF NOT EXISTS public.system_bot_mod_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  action text NOT NULL,
  target_user_id bigint,
  target_username text,
  reason text,
  performed_by bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sbml_chat ON public.system_bot_mod_log(chat_id, created_at DESC);
GRANT SELECT ON public.system_bot_mod_log TO authenticated;
GRANT ALL ON public.system_bot_mod_log TO service_role;
ALTER TABLE public.system_bot_mod_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view mod log" ON public.system_bot_mod_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'::app_role));

-- 9) Flood tracking (ephemeral, simple counter)
CREATE TABLE IF NOT EXISTS public.system_bot_flood (
  chat_id bigint NOT NULL,
  user_id bigint NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count int NOT NULL DEFAULT 1,
  PRIMARY KEY (chat_id, user_id)
);
GRANT ALL ON public.system_bot_flood TO service_role;
ALTER TABLE public.system_bot_flood ENABLE ROW LEVEL SECURITY;

-- updated_at trigger for groups
DROP TRIGGER IF EXISTS trg_sbg_updated ON public.system_bot_groups;
CREATE TRIGGER trg_sbg_updated BEFORE UPDATE ON public.system_bot_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
