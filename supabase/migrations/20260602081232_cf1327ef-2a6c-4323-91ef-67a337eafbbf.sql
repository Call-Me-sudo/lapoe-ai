-- Unanswered questions inbox: when bot fails to answer, log here for owner to address
CREATE TABLE public.unanswered_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  bot_id uuid NOT NULL,
  group_id uuid,
  question text NOT NULL,
  normalized_question text NOT NULL,
  asker text,
  ask_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending', -- pending | answered | dismissed
  answer text,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, normalized_question)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unanswered_questions TO authenticated;
GRANT ALL ON public.unanswered_questions TO service_role;

ALTER TABLE public.unanswered_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own unanswered"
ON public.unanswered_questions
FOR ALL
TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));

CREATE INDEX idx_unanswered_owner_status ON public.unanswered_questions (owner_id, status, updated_at DESC);
CREATE INDEX idx_unanswered_bot ON public.unanswered_questions (bot_id);

CREATE TRIGGER trg_unanswered_updated_at
BEFORE UPDATE ON public.unanswered_questions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();