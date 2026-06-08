ALTER TABLE public.conversation_contexts
  ALTER COLUMN bot_id DROP NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_contexts TO authenticated;
GRANT ALL ON public.conversation_contexts TO service_role;

DROP TRIGGER IF EXISTS cc_set_updated_at ON public.conversation_contexts;
CREATE TRIGGER cc_set_updated_at
  BEFORE UPDATE ON public.conversation_contexts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();