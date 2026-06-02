CREATE TABLE IF NOT EXISTS public.bot_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid REFERENCES public.bots(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'user_bot_dm',
  telegram_user_id bigint,
  telegram_username text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.bot_feedback TO authenticated;
GRANT ALL ON public.bot_feedback TO service_role;
ALTER TABLE public.bot_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read their bot feedback" ON public.bot_feedback
  FOR SELECT TO authenticated
  USING (bot_id IN (SELECT id FROM public.bots WHERE owner_id = auth.uid()) OR public.has_role(auth.uid(), 'owner'));