
ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_group_title text,
  ADD COLUMN IF NOT EXISTS auto_updated_at timestamptz;

ALTER TABLE public.knowledge_sources DROP CONSTRAINT IF EXISTS knowledge_sources_scope_check;
ALTER TABLE public.knowledge_sources ADD CONSTRAINT knowledge_sources_scope_check
  CHECK (scope = ANY (ARRAY['bot'::text, 'system_bot'::text, 'bot_auto'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_sources_bot_auto_uniq
  ON public.knowledge_sources (bot_id, telegram_chat_id)
  WHERE auto_generated = true AND telegram_chat_id IS NOT NULL;

ALTER TABLE public.telegram_groups
  ADD COLUMN IF NOT EXISTS admin_ids bigint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS admin_ids_refreshed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.auto_kb_buffer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id text NOT NULL,
  group_title text,
  sender_id bigint,
  sender_name text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auto_kb_buffer_bot_chat_idx ON public.auto_kb_buffer (bot_id, telegram_chat_id, created_at);

GRANT SELECT ON public.auto_kb_buffer TO authenticated;
GRANT ALL ON public.auto_kb_buffer TO service_role;
ALTER TABLE public.auto_kb_buffer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own auto kb buffer" ON public.auto_kb_buffer
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'owner'::app_role));
