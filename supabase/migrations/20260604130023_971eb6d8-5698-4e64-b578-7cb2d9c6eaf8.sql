
-- 1. Plan limits update: free = 0 bots, 1 group, 30 AI msgs
CREATE OR REPLACE FUNCTION public.plan_limits(_plan plan_tier)
 RETURNS TABLE(max_bots integer, max_groups integer, max_monthly_messages integer, max_msgs_per_minute integer)
 LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT
    CASE _plan
      WHEN 'free'     THEN 0
      WHEN 'starter'  THEN 3
      WHEN 'pro'      THEN 10
      WHEN 'business' THEN 1000000
      ELSE 0
    END,
    CASE _plan
      WHEN 'free'     THEN 1
      WHEN 'starter'  THEN 10
      WHEN 'pro'      THEN 1000000
      WHEN 'business' THEN 1000000
      ELSE 1
    END,
    CASE _plan
      WHEN 'free'     THEN 30
      WHEN 'starter'  THEN 10000
      WHEN 'pro'      THEN 100000
      WHEN 'business' THEN 100000000
      ELSE 30
    END,
    CASE _plan
      WHEN 'free'     THEN 5
      WHEN 'starter'  THEN 20
      WHEN 'pro'      THEN 60
      WHEN 'business' THEN 240
      ELSE 5
    END;
$function$;

-- 2. system_bot_personas
CREATE TABLE public.system_bot_personas (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  tone text NOT NULL DEFAULT 'friendly',
  personality text,
  welcome_message text,
  house_rules text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_bot_personas TO authenticated;
GRANT ALL ON public.system_bot_personas TO service_role;
ALTER TABLE public.system_bot_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own persona" ON public.system_bot_personas
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));
CREATE TRIGGER trg_sbp_updated BEFORE UPDATE ON public.system_bot_personas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Link a system_bot_group to a free user
ALTER TABLE public.system_bot_groups
  ADD COLUMN IF NOT EXISTS linked_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sbg_linked_owner ON public.system_bot_groups(linked_owner_id);

-- 4. Knowledge: optional bot_id, scope flag
ALTER TABLE public.knowledge_sources ALTER COLUMN bot_id DROP NOT NULL;
ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'bot' CHECK (scope IN ('bot','system_bot'));
ALTER TABLE public.knowledge_chunks ALTER COLUMN bot_id DROP NOT NULL;
ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'bot' CHECK (scope IN ('bot','system_bot'));
CREATE INDEX IF NOT EXISTS idx_kc_system_owner ON public.knowledge_chunks(owner_id) WHERE scope = 'system_bot';

-- 5. System-bot RAG search (text)
CREATE OR REPLACE FUNCTION public.match_system_knowledge_text(_owner_id uuid, _query text, _match_count integer DEFAULT 5)
 RETURNS TABLE(id uuid, source_id uuid, content text, similarity double precision)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH q AS (SELECT plainto_tsquery('english', coalesce(_query, '')) AS tsq)
  SELECT c.id, c.source_id, c.content,
         ts_rank(c.content_tsv, q.tsq)::double precision AS similarity
  FROM public.knowledge_chunks c, q
  WHERE c.owner_id = _owner_id
    AND c.scope = 'system_bot'
    AND (q.tsq = ''::tsquery OR c.content_tsv @@ q.tsq)
  ORDER BY similarity DESC NULLS LAST, c.chunk_index ASC
  LIMIT _match_count;
$function$;

-- 6. Bump monthly AI counter for a user (system bot uses this)
CREATE OR REPLACE FUNCTION public.bump_system_bot_usage(_owner_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.monthly_usage (owner_id, period_start, outbound_count)
  VALUES (_owner_id, date_trunc('month', now())::date, 1)
  ON CONFLICT (owner_id, period_start)
  DO UPDATE SET outbound_count = public.monthly_usage.outbound_count + 1,
                updated_at = now();
END;
$function$;

-- 7. System bot usage status for an owner
CREATE OR REPLACE FUNCTION public.system_bot_usage(_owner_id uuid)
 RETURNS TABLE(plan plan_tier, monthly_messages integer, max_monthly_messages integer, allowed boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH p AS (SELECT public.user_plan(_owner_id) AS plan),
       l AS (SELECT * FROM public.plan_limits((SELECT plan FROM p))),
       m AS (
         SELECT COALESCE(outbound_count, 0)::int AS c
         FROM public.monthly_usage
         WHERE owner_id = _owner_id
           AND period_start = date_trunc('month', now())::date
       )
  SELECT
    (SELECT plan FROM p),
    COALESCE((SELECT c FROM m), 0),
    (SELECT max_monthly_messages FROM l),
    COALESCE((SELECT c FROM m), 0) < (SELECT max_monthly_messages FROM l);
$function$;

-- 8. Convenience RPC for current authed user (used by dashboard)
CREATE OR REPLACE FUNCTION public.my_system_bot_usage()
 RETURNS TABLE(plan plan_tier, monthly_messages integer, max_monthly_messages integer, allowed boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT * FROM public.system_bot_usage(auth.uid()) WHERE auth.uid() IS NOT NULL;
$function$;

-- 9. One-time cleanup: notify + delete free-plan bots
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT b.id, b.owner_id, b.name
    FROM public.bots b
    WHERE public.user_plan(b.owner_id) = 'free'
  LOOP
    INSERT INTO public.notifications (title, body, type, audience, user_id, link)
    VALUES (
      'Your bot was removed',
      'The free plan no longer supports custom bots. Your bot "' || rec.name || '" was removed. Use our shared assistant @LaPoe_bot from your dashboard, or upgrade to bring back custom bots.',
      'system', 'user', rec.owner_id, '/pricing'
    );
  END LOOP;

  DELETE FROM public.bots
  WHERE public.user_plan(owner_id) = 'free';
END $$;
