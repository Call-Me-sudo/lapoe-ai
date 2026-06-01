-- Security hardening: search_path + tighten EXECUTE privileges
-- 1. Set immutable search_path on plan_limits (linter warn)
ALTER FUNCTION public.plan_limits(plan_tier) SET search_path = public;

-- 2. Trigger-only functions: must not be callable by clients
REVOKE EXECUTE ON FUNCTION public.handle_new_user()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_bot_quota()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_group_quota()  FROM PUBLIC, anon, authenticated;

-- 3. User-only RPCs: anon cannot execute; authenticated still can
REVOKE EXECUTE ON FUNCTION public.my_workspace_usage()           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_bot_quota()                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_create_bot(uuid)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_plan(uuid)                FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_workspace_usage()           TO authenticated;
GRANT  EXECUTE ON FUNCTION public.my_bot_quota()                 TO authenticated;
GRANT  EXECUTE ON FUNCTION public.can_create_bot(uuid)           TO authenticated;
GRANT  EXECUTE ON FUNCTION public.user_plan(uuid)                TO authenticated;

-- 4. Service-role-only RPCs (called from edge functions with service key)
REVOKE EXECUTE ON FUNCTION public.match_knowledge_chunks_text(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bot_usage_status(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.match_knowledge_chunks_text(uuid, text, integer) TO service_role;
GRANT  EXECUTE ON FUNCTION public.bot_usage_status(uuid)                            TO service_role;

-- 5. plan_limits is a pure lookup — safe to keep readable by signed-in users only
REVOKE EXECUTE ON FUNCTION public.plan_limits(plan_tier) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.plan_limits(plan_tier) TO authenticated, service_role;

-- 6. has_role is invoked from RLS policies (definer); keep callable by signed-in users only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;