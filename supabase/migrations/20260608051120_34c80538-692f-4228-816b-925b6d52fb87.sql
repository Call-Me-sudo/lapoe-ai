REVOKE EXECUTE ON FUNCTION public.get_or_create_conversation_context(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_conversation_context(uuid, public.conversation_topic, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation_context(uuid, uuid, uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_conversation_context(uuid, public.conversation_topic, text, text, uuid) TO authenticated, service_role;