CREATE TABLE IF NOT EXISTS public.security_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  position smallint NOT NULL CHECK (position IN (1,2)),
  question text NOT NULL,
  answer_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, position)
);
CREATE INDEX IF NOT EXISTS security_questions_email_idx ON public.security_questions (email);
GRANT ALL ON public.security_questions TO service_role;
ALTER TABLE public.security_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can view their own security questions" ON public.security_questions;
CREATE POLICY "Owners can view their own security questions" ON public.security_questions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT ON public.security_questions TO authenticated;

-- Close self-join privilege escalation: only a team leader may add members.
DROP POLICY IF EXISTS "Users can join or be added by their leader" ON public.team_members;
CREATE POLICY "Only team leaders can add members" ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.leader_id = auth.uid()));