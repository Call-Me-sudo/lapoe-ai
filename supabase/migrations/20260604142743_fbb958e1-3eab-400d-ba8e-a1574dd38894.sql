
-- Allow system bot rows (bot_id NULL) in message + inbox tables.
ALTER TABLE public.bot_messages ALTER COLUMN bot_id DROP NOT NULL;

ALTER TABLE public.unanswered_questions ALTER COLUMN bot_id DROP NOT NULL;

-- Replace bot-only unique with one that also covers system-bot rows (bot_id null).
ALTER TABLE public.unanswered_questions
  DROP CONSTRAINT IF EXISTS unanswered_questions_bot_id_normalized_question_key;

CREATE UNIQUE INDEX IF NOT EXISTS unanswered_questions_bot_norm_uniq
  ON public.unanswered_questions (bot_id, normalized_question)
  WHERE bot_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unanswered_questions_sysbot_norm_uniq
  ON public.unanswered_questions (owner_id, normalized_question)
  WHERE bot_id IS NULL;
