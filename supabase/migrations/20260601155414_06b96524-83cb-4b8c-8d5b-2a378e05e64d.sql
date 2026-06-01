
CREATE OR REPLACE FUNCTION public.my_workspace_usage()
 RETURNS TABLE(plan plan_tier, current_bots integer, max_bots integer, monthly_messages integer, max_monthly_messages integer, max_msgs_per_minute integer, period_start timestamp with time zone, period_end timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH p AS (SELECT public.user_plan(auth.uid()) AS plan),
       l AS (SELECT * FROM public.plan_limits((SELECT plan FROM p))),
       b AS (SELECT count(*)::int AS c FROM public.bots WHERE owner_id = auth.uid()),
       m AS (
         SELECT count(*)::int AS c
         FROM public.bot_messages
         WHERE owner_id = auth.uid()
           AND direction = 'outbound'
           AND created_at >= date_trunc('month', now())
       )
  SELECT
    (SELECT plan FROM p),
    (SELECT c FROM b),
    (SELECT max_bots FROM l),
    (SELECT c FROM m),
    (SELECT max_monthly_messages FROM l),
    (SELECT max_msgs_per_minute FROM l),
    date_trunc('month', now()),
    (date_trunc('month', now()) + interval '1 month')
  WHERE auth.uid() IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.bot_usage_status(_bot_id uuid)
 RETURNS TABLE(plan plan_tier, monthly_messages integer, max_monthly_messages integer, max_msgs_per_minute integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH b AS (SELECT owner_id FROM public.bots WHERE id = _bot_id),
       p AS (SELECT public.user_plan((SELECT owner_id FROM b)) AS plan),
       l AS (SELECT * FROM public.plan_limits((SELECT plan FROM p))),
       m AS (
         SELECT count(*)::int AS c
         FROM public.bot_messages
         WHERE owner_id = (SELECT owner_id FROM b)
           AND direction = 'outbound'
           AND created_at >= date_trunc('month', now())
       )
  SELECT (SELECT plan FROM p), (SELECT c FROM m),
         (SELECT max_monthly_messages FROM l),
         (SELECT max_msgs_per_minute FROM l);
$function$;
