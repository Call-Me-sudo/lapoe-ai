
-- Notifications system
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL DEFAULT 'admin', -- 'admin' | 'system'
  audience text NOT NULL DEFAULT 'user', -- 'all' | 'plan' | 'user'
  plan plan_tier,
  user_id uuid, -- target user when audience='user'
  link text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can see notifications targeted at them, their plan, or everyone
CREATE POLICY "Users view applicable notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR audience = 'all'
  OR (audience = 'user' AND user_id = auth.uid())
  OR (audience = 'plan' AND plan = public.user_plan(auth.uid()))
);

-- Only owners/admins can insert/manage
CREATE POLICY "Owners manage notifications"
ON public.notifications FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow system inserts (type='system', created_by = auth.uid() = user_id self-notification)
CREATE POLICY "Users insert own system notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (type = 'system' AND user_id = auth.uid());

-- Read tracking
CREATE TABLE public.notification_reads (
  notification_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reads"
ON public.notification_reads FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
