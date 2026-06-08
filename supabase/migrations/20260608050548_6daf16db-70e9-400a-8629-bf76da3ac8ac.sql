DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'conversation_topic'
  ) THEN
    CREATE TYPE public.conversation_topic AS ENUM (
      'referral_bonus',
      'star_sales',
      'payment_status',
      'account_setup',
      'withdrawal',
      'general_support',
      'product_inquiry',
      'technical_issue',
      'other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.conversation_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid REFERENCES public.bots(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  group_id uuid REFERENCES public.telegram_groups(id) ON DELETE SET NULL,
  telegram_user text NOT NULL,
  primary_topic public.conversation_topic NOT NULL DEFAULT 'other',
  secondary_topics public.conversation_topic[] DEFAULT '{}',
  first_message_id uuid REFERENCES public.bot_messages(id) ON DELETE SET NULL,
  last_message_id uuid REFERENCES public.bot_messages(id) ON DELETE SET NULL,
  last_bot_reply_id uuid REFERENCES public.bot_messages(id) ON DELETE SET NULL,
  context_summary text,
  user_intent text,
  message_count int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_contexts TO authenticated;
GRANT ALL ON public.conversation_contexts TO service_role;

ALTER TABLE public.conversation_contexts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_contexts' AND policyname = 'Owners view own contexts'
  ) THEN
    CREATE POLICY "Owners view own contexts" ON public.conversation_contexts
      FOR SELECT TO authenticated
      USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'owner'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_contexts' AND policyname = 'Owners insert own contexts'
  ) THEN
    CREATE POLICY "Owners insert own contexts" ON public.conversation_contexts
      FOR INSERT TO authenticated
      WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'owner'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_contexts' AND policyname = 'Owners update own contexts'
  ) THEN
    CREATE POLICY "Owners update own contexts" ON public.conversation_contexts
      FOR UPDATE TO authenticated
      USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'owner'::app_role))
      WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'owner'::app_role));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversation_contexts_bot_user
  ON public.conversation_contexts(bot_id, telegram_user, is_active);
CREATE INDEX IF NOT EXISTS idx_conversation_contexts_owner_system_user
  ON public.conversation_contexts(owner_id, telegram_user, is_active)
  WHERE bot_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_contexts_group_user
  ON public.conversation_contexts(group_id, telegram_user, is_active);
CREATE INDEX IF NOT EXISTS idx_conversation_contexts_last_activity
  ON public.conversation_contexts(last_activity_at);

CREATE TRIGGER cc_set_updated_at
  BEFORE UPDATE ON public.conversation_contexts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.get_or_create_conversation_context(
  _bot_id uuid,
  _owner_id uuid,
  _group_id uuid,
  _telegram_user text,
  _current_message_id uuid default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _context_id uuid;
  _context record;
  _context_age_minutes int;
BEGIN
  SELECT id, message_count, context_summary, user_intent, primary_topic, last_activity_at
  INTO _context
  FROM public.conversation_contexts
  WHERE ((_bot_id IS NULL AND bot_id IS NULL) OR bot_id = _bot_id)
    AND owner_id = _owner_id
    AND telegram_user = _telegram_user
    AND is_active = true
    AND (_group_id IS NULL OR group_id = _group_id)
    AND now() - last_activity_at < interval '24 hours'
  ORDER BY last_activity_at DESC
  LIMIT 1;

  IF FOUND THEN
    _context_age_minutes := extract(epoch from (now() - _context.last_activity_at)) / 60;

    IF _context_age_minutes > 120 THEN
      UPDATE public.conversation_contexts
      SET is_active = false, updated_at = now()
      WHERE id = _context.id;
    ELSE
      UPDATE public.conversation_contexts
      SET
        message_count = message_count + 1,
        last_message_id = _current_message_id,
        last_activity_at = now(),
        updated_at = now()
      WHERE id = _context.id;

      RETURN json_build_object(
        'context_id', _context.id,
        'message_count', _context.message_count + 1,
        'context_summary', _context.context_summary,
        'user_intent', _context.user_intent,
        'primary_topic', _context.primary_topic,
        'is_existing', true
      );
    END IF;
  END IF;

  INSERT INTO public.conversation_contexts(
    bot_id, owner_id, group_id, telegram_user,
    first_message_id, last_message_id, message_count
  ) VALUES (
    _bot_id, _owner_id, _group_id, _telegram_user,
    _current_message_id, _current_message_id, 1
  )
  RETURNING id INTO _context_id;

  RETURN json_build_object(
    'context_id', _context_id,
    'message_count', 1,
    'context_summary', null,
    'user_intent', null,
    'primary_topic', 'other'::text,
    'is_existing', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_conversation_context(
  _context_id uuid,
  _primary_topic public.conversation_topic default null,
  _context_summary text default null,
  _user_intent text default null,
  _last_bot_reply_id uuid default null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversation_contexts
  SET
    primary_topic = coalesce(_primary_topic, primary_topic),
    context_summary = coalesce(_context_summary, context_summary),
    user_intent = coalesce(_user_intent, user_intent),
    last_bot_reply_id = coalesce(_last_bot_reply_id, last_bot_reply_id),
    last_activity_at = now(),
    updated_at = now()
  WHERE id = _context_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_conversation_context(uuid, uuid, uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_conversation_context(uuid, public.conversation_topic, text, text, uuid) TO authenticated, service_role;