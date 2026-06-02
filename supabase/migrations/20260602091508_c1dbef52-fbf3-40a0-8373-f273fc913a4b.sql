ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS poll_locked_until timestamptz;
CREATE INDEX IF NOT EXISTS idx_bots_poll_lock ON public.bots(poll_locked_until);