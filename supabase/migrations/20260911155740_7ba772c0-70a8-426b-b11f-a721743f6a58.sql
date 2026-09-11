-- 1. Team member details
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS prn text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS year text;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS finalized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_mentor_id uuid REFERENCES public.mentors(id),
  ADD COLUMN IF NOT EXISTS industrial_mentor_user_id uuid,
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id),
  ADD COLUMN IF NOT EXISTS cycle_year integer,
  ADD COLUMN IF NOT EXISTS process_completed boolean NOT NULL DEFAULT false;

-- 2. Mentor ratings
CREATE TABLE IF NOT EXISTS public.mentor_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  rater_user_id uuid NOT NULL,
  mentor_kind text NOT NULL CHECK (mentor_kind IN ('college','industrial')),
  mentor_label text NOT NULL DEFAULT '',
  overall integer NOT NULL CHECK (overall BETWEEN 1 AND 5),
  guidance integer NOT NULL CHECK (guidance BETWEEN 1 AND 5),
  availability integer NOT NULL CHECK (availability BETWEEN 1 AND 5),
  technical integer NOT NULL CHECK (technical BETWEEN 1 AND 5),
  communication integer NOT NULL CHECK (communication BETWEEN 1 AND 5),
  helpfulness integer NOT NULL CHECK (helpfulness BETWEEN 1 AND 5),
  feedback text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, rater_user_id, mentor_kind)
);
GRANT SELECT, INSERT, UPDATE ON public.mentor_ratings TO authenticated;
GRANT ALL ON public.mentor_ratings TO service_role;
ALTER TABLE public.mentor_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members read own team ratings" ON public.mentor_ratings
  FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "Members submit own rating" ON public.mentor_ratings
  FOR INSERT TO authenticated
  WITH CHECK (rater_user_id = auth.uid() AND public.is_team_member(team_id, auth.uid()));
CREATE POLICY "Members update own rating" ON public.mentor_ratings
  FOR UPDATE TO authenticated
  USING (rater_user_id = auth.uid())
  WITH CHECK (rater_user_id = auth.uid());

-- 3. Certificates
CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  cycle_year integer NOT NULL,
  student_name text NOT NULL,
  team_name text NOT NULL,
  institution text NOT NULL DEFAULT '',
  ps_id text,
  ps_title text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cycle_year)
);
GRANT SELECT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own certificate" ON public.certificates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- 4. SIH cycle calendar
CREATE TABLE IF NOT EXISTS public.sih_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_year integer NOT NULL UNIQUE,
  edition_label text NOT NULL DEFAULT '',
  official_start date,
  official_end date,
  source_url text NOT NULL DEFAULT 'https://www.sih.gov.in/',
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid,
  last_checked_at timestamptz,
  check_status text NOT NULL DEFAULT 'pending',
  check_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sih_cycles TO authenticated;
GRANT SELECT ON public.sih_cycles TO anon;
GRANT ALL ON public.sih_cycles TO service_role;
ALTER TABLE public.sih_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read the cycle calendar" ON public.sih_cycles
  FOR SELECT USING (true);
CREATE POLICY "Admins and faculty manage cycles" ON public.sih_cycles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'faculty'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'faculty'));

CREATE TRIGGER sih_cycles_updated_at BEFORE UPDATE ON public.sih_cycles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS mentor_ratings_team_idx ON public.mentor_ratings(team_id);
CREATE INDEX IF NOT EXISTS certificates_user_idx ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS team_members_user_idx ON public.team_members(user_id);