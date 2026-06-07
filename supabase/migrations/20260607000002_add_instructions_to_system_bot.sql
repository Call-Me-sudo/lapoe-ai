-- Add default_instructions support to system bot personas
-- This enables system bots (@LaPoe_bot) to have explicit instructions just like user bots

ALTER TABLE public.system_bot_personas ADD COLUMN IF NOT EXISTS default_instructions text;

-- Add comment for clarity
COMMENT ON COLUMN public.system_bot_personas.default_instructions IS 
  'Owner-defined instructions for how the system bot should behave. These take priority over default rules.';
