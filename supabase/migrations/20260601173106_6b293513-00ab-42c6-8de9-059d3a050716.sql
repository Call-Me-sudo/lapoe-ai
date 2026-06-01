
-- Welcome notification on profile creation
CREATE OR REPLACE FUNCTION public.notify_welcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (title, body, type, audience, user_id)
  VALUES (
    'Welcome to KADE 👋',
    'Your workspace is ready. Add your first Telegram bot to get started.',
    'system', 'user', NEW.id
  );
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_welcome_notify
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_welcome();

-- Plan change notification
CREATE OR REPLACE FUNCTION public.notify_plan_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.plan IS DISTINCT FROM OLD.plan THEN
    INSERT INTO public.notifications (title, body, type, audience, user_id)
    VALUES (
      'Plan updated',
      'Your plan is now ' || NEW.plan || '. New limits are active immediately.',
      'system', 'user', NEW.user_id
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER subscriptions_plan_notify
AFTER UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.notify_plan_change();

-- New bot notification
CREATE OR REPLACE FUNCTION public.notify_bot_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (title, body, type, audience, user_id, link)
  VALUES (
    'Bot added',
    'Your bot "' || NEW.name || '" is live in your workspace.',
    'system', 'user', NEW.owner_id, '/dashboard/bots'
  );
  RETURN NEW;
END $$;

CREATE TRIGGER bots_created_notify
AFTER INSERT ON public.bots
FOR EACH ROW EXECUTE FUNCTION public.notify_bot_created();
