
CREATE TABLE IF NOT EXISTS public.monthly_usage (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  outbound_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, period_start)
);

GRANT SELECT ON public.monthly_usage TO authenticated;
GRANT ALL ON public.monthly_usage TO service_role;

ALTER TABLE public.monthly_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view own usage" ON public.monthly_usage;
CREATE POLICY "Owners view own usage" ON public.monthly_usage
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));

CREATE OR REPLACE FUNCTION public.increment_monthly_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'outbound' THEN
    INSERT INTO public.monthly_usage (owner_id, period_start, outbound_count)
    VALUES (NEW.owner_id, date_trunc('month', NEW.created_at)::date, 1)
    ON CONFLICT (owner_id, period_start)
    DO UPDATE SET outbound_count = public.monthly_usage.outbound_count + 1,
                  updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_messages_usage ON public.bot_messages;
CREATE TRIGGER trg_bot_messages_usage
AFTER INSERT ON public.bot_messages
FOR EACH ROW EXECUTE FUNCTION public.increment_monthly_usage();

-- Backfill existing data
INSERT INTO public.monthly_usage (owner_id, period_start, outbound_count)
SELECT owner_id, date_trunc('month', created_at)::date, count(*)::int
FROM public.bot_messages
WHERE direction = 'outbound'
GROUP BY owner_id, date_trunc('month', created_at)::date
ON CONFLICT (owner_id, period_start)
DO UPDATE SET outbound_count = EXCLUDED.outbound_count;

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
         SELECT COALESCE(outbound_count, 0)::int AS c
         FROM public.monthly_usage
         WHERE owner_id = auth.uid()
           AND period_start = date_trunc('month', now())::date
       )
  SELECT
    (SELECT plan FROM p),
    (SELECT c FROM b),
    (SELECT max_bots FROM l),
    COALESCE((SELECT c FROM m), 0),
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
         SELECT COALESCE(outbound_count, 0)::int AS c
         FROM public.monthly_usage
         WHERE owner_id = (SELECT owner_id FROM b)
           AND period_start = date_trunc('month', now())::date
       )
  SELECT (SELECT plan FROM p),
         COALESCE((SELECT c FROM m), 0),
         (SELECT max_monthly_messages FROM l),
         (SELECT max_msgs_per_minute FROM l);
$function$;
