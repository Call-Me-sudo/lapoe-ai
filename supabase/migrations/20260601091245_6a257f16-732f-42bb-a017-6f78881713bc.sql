ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS anti_flood_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anti_spam_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flood_sensitivity integer NOT NULL DEFAULT 5;