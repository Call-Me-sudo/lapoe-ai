GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_bot_groups TO authenticated;
GRANT ALL ON public.system_bot_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_bot_state TO authenticated;
GRANT ALL ON public.system_bot_state TO service_role;

UPDATE public.knowledge_chunks AS c
SET scope = 'system_bot'
FROM public.knowledge_sources AS s
WHERE c.source_id = s.id
  AND s.scope = 'system_bot'
  AND c.scope IS DISTINCT FROM 'system_bot';