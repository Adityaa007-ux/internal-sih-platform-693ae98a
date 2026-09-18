import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loginWithPassword, type PortalRole } from "@/lib/auth.functions";
import {
  checkEmailAvailable,
  registerAccount,
  getSecurityQuestions,
  resetPasswordWithAnswer,
} from "@/lib/account.functions";
import {
  lookupInstitutionByEmail,
  listCampuses,
  searchInstitutions,
  type CampusOption,
  type InstitutionOption,
} from "@/lib/institutions.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setActiveRole } from "@/lib/active-role";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Internal Smart India Hackathon Platform" },
      {
        name: "description",
        content:
          "Secure sign in and registration for the Internal Smart India Hackathon platform — students, faculty members, mentors and administrators across participating institutions and campuses.",
      },
      { property: "og:title", content: "Internal Smart India Hackathon Platform" },
      {
        property: "og:description",
        content:
          "AI-powered Internal SIH registration, evaluation and selection platform for participating institutions, colleges and campuses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const ROLE_OPTIONS: { id: PortalRole; label: string; icon: typeof UserRound; note: string }[] = [
  { id: "student", label: "Student", icon: UserRound, note: "Team & proposals" },
  { id: "faculty", label: "Faculty Member", icon: GraduationCap, note: "Review & shortlist" },
  { id: "admin", label: "Administrator", icon: UserCog, note: "Platform administration" },
  { id: "mentor", label: "Mentor", icon: Users, note: "Guidance & teams" },
];

const ROLE_LABEL: Record<PortalRole, string> = {
  student: "Student",
  faculty: "Faculty Member",
  admin: "Administrator",
  mentor: "Mentor",
};

function landingFor(role: PortalRole): string {
  return role === "admin" ? "/admin" : "/dashboard";
}

type Mode = "choose" | "login" | "signup";
type SignupStep = "email" | "campus" | "security" | "password" | "done";
type LoginStep = "credentials" | "forgot" | "forgot-answer";

function strongPassword(v: string): boolean {
  return v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v);
}

function AuthPage() {
  const navigate = useNavigate();
  const login = useServerFn(loginWithPassword);
  const checkEmail = useServerFn(checkEmailAvailable);
  const register = useServerFn(registerAccount);
  const fetchQuestions = useServerFn(getSecurityQuestions);
  const resetPassword = useServerFn(resetPasswordWithAnswer);
  const lookup = useServerFn(lookupInstitutionByEmail);
  const campusesFor = useServerFn(listCampuses);
  const instSearchFn = useServerFn(searchInstitutions);

  const [role, setRole] = useState<PortalRole | null>(null);
  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);

  // login
  const [loginStep, setLoginStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // forgot password
  const [questions, setQuestions] = useState<{ position: number; question: string }[]>([]);
  const [pickedQuestion, setPickedQuestion] = useState(1);
  const [answer, setAnswer] = useState("");

  // signup
  const [step, setStep] = useState<SignupStep>("email");
  const [institution, setInstitution] = useState<InstitutionOption | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [recognized, setRecognized] = useState(true);
  const [instSearch, setInstSearch] = useState("");
  const [instResults, setInstResults] = useState<InstitutionOption[]>([]);
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [campusSearch, setCampusSearch] = useState("");
  const [campusId, setCampusId] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [prn, setPrn] = useState("");
  const [q1, setQ1] = useState("");
  const [a1, setA1] = useState("");
  const [q2, setQ2] = useState("");
  const [a2, setA2] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const visibleCampuses = useMemo(() => {
    const q = campusSearch.trim().toLowerCase();
    if (!q) return campuses;
    return campuses.filter(
      (c) => c.campus_name.toLowerCase().includes(q) || (c.city ?? "").toLowerCase().includes(q),
    );
  }, [campuses, campusSearch]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  function err(e: unknown, fallback: string) {
    toast.error(e instanceof Error && e.message ? e.message : fallback);
  }

  /* ---------------- login ---------------- */

  async function doLogin() {
    if (busy || !role) return;
    setBusy(true);
    try {
      const res = await login({ data: { role, identifier: email.trim(), password } });
      const { error } = await supabase.auth.setSession({
        access_token: res.accessToken,
        refresh_token: res.refreshToken,
      });
      if (error) throw new Error(error.message);
      setActiveRole(role);
      toast.success(`Welcome back, ${res.fullName || "there"}.`);
      window.location.assign(landingFor(role));
    } catch (e) {
      err(e, "Sign in failed. Please check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  async function loadQuestions() {
    if (busy) return;
    if (!email.trim()) {
      toast.error("Enter your registered email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetchQuestions({ data: { email: email.trim().toLowerCase() } });
      setQuestions(res.questions);
      setPickedQuestion(res.questions[0]?.position ?? 1);
      setAnswer("");
      setNewPw("");
      setConfirmPw("");
      setLoginStep("forgot-answer");
    } catch (e) {
      err(e, "We could not load your security questions.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset() {
    if (busy) return;
    if (newPw !== confirmPw) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!strongPassword(newPw)) {
      toast.error(
        "Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character.",
      );
      return;
    }
    setBusy(true);
    try {
      await resetPassword({
        data: {
          email: email.trim().toLowerCase(),
          position: pickedQuestion,
          answer,
          password: newPw,
          confirmPassword: confirmPw,
        },
      });
      toast.success("Password updated. Please sign in with your new password.");
      setLoginStep("credentials");
      setPassword("");
    } catch (e) {
      err(e, "Could not reset your password.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- signup ---------------- */

  async function doLookup() {
    if (busy) return;
    setBusy(true);
    try {
      await checkEmail({ data: { email: email.trim().toLowerCase() } });
      const res = await lookup({ data: { email: email.trim().toLowerCase() } });
      setInstitutions(res.institutions);
      setRecognized(res.recognized);
      setInstitution(res.institution);
      setCampuses(res.campuses);
      setCampusId("");
      setCampusSearch("");
      setInstSearch(res.institution?.official_name ?? "");
      setInstResults([]);
      setStep("campus");
    } catch (e) {
      err(e, "Enter a valid email address.");
    } finally {
      setBusy(false);
    }
  }

  async function runInstSearch(q: string) {
    setInstSearch(q);
    if (q.trim().length < 2) return setInstResults([]);
    try {
      setInstResults(await instSearchFn({ data: { q: q.trim() } }));
    } catch {
      setInstResults([]);
    }
  }

  async function pickInstitution(id: string) {
    const inst = [...institutions, ...instResults].find((i) => i.id === id) ?? null;
    setInstitution(inst);
    setInstSearch(inst?.official_name ?? "");
    setInstResults([]);
    setCampusId("");
    setCampusSearch("");
    if (!inst) return setCampuses([]);
    setCampuses(await campusesFor({ data: { institutionId: inst.id } }));
  }

  function goToSecurity(): void {
    if (fullName.trim().length < 3) {
      toast.error("Enter your full name.");
      return;
    }
    if (!institution) {
      toast.error("Select your institution.");
      return;
    }
    if (!campusId) {
      toast.error("Select your campus.");
      return;
    }
    setStep("security");
  }

  function goToPassword(): void {
    if (q1.trim().length < 8 || a1.trim().length < 2) {
      toast.error("Complete security question 1.");
      return;
    }
    if (q2.trim().length < 8 || a2.trim().length < 2) {
      toast.error("Complete security question 2.");
      return;
    }
    if (q1.trim().toLowerCase() === q2.trim().toLowerCase()) {
      toast.error("Your two security questions must be different.");
      return;
    }
    setStep("password");
  }

  async function completeRegistration() {
    if (busy || !role || !institution) return;
    setBusy(true);
    try {
      await register({
        data: {
          role,
          email: email.trim().toLowerCase(),
          fullName,
          mobile: mobile || undefined,
          prn: prn || undefined,
          institutionId: institution.id,
          campusId,
          password: newPw,
          confirmPassword: confirmPw,
          questions: [
            { question: q1.trim(), answer: a1 },
            { question: q2.trim(), answer: a2 },
          ],
        },
      });
      setStep("done");
      toast.success("Account created. Please sign in with your email and password.");
    } catch (e) {
      err(e, "Could not complete registration.");
    } finally {
      setBusy(false);
    }
  }

  function backToLogin() {
    setMode("login");
    setLoginStep("credentials");
    setStep("email");
    setPassword("");
    setNewPw("");
    setConfirmPw("");
  }

  /* ---------------- render ---------------- */

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden brand-gradient p-10 text-primary-foreground lg:flex">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
            <GraduationCap className="size-6" />
          </span>
          <div>
            <p className="font-display text-lg font-bold leading-tight">Internal SIH</p>
            <p className="text-xs opacity-80">Internal Smart India Hackathon Platform</p>
          </div>
        </div>
        <div className="relative max-w-md space-y-6">
          <h1 className="font-display text-4xl font-bold leading-tight">
            Welcome to Internal Smart India Hackathon
          </h1>
          <p className="text-sm leading-relaxed opacity-90">
            One platform for registration, problem selection, proposal submission, AI evaluation, similarity
            detection, mentoring and final selection across every participating institution and campus.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              { icon: BrainCircuit, t: "AI Proposal Analyzer with section-wise scoring" },
              { icon: Sparkles, t: "Idea similarity & duplication detection" },
              { icon: Bot, t: "24×7 AI Assistant for student guidance" },
              { icon: ShieldCheck, t: "Role-based access with self-set security questions" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-4" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs opacity-70">© {new Date().getFullYear()} Internal Smart India Hackathon</p>
      </section>

      <section className="flex items-center justify-center bg-background px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl brand-gradient text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold">Internal SIH</p>
              <p className="text-xs text-muted-foreground">Internal Smart India Hackathon Platform</p>
            </div>
          </div>

          <div className="surface-card p-6">
            {mode === "choose" && (
              <>
                <h2 className="font-display text-xl font-bold">Welcome to Internal Smart India Hackathon</h2>
                <p className="mt-1 text-sm text-muted-foreground">Select your role to continue.</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map(({ id, label, icon: Icon, note }) => (
                    <button
                      type="button"
                      key={id}
                      onClick={() => setRole(id)}
                      className={cn(
                        "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        role === id
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="size-4" />
                        {label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{note}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button disabled={!role} onClick={() => setMode("login")}>
                    <KeyRound className="size-4" />
                    Login
                  </Button>
                  <Button variant="outline" disabled={!role} onClick={() => setMode("signup")}>
                    Sign Up
                  </Button>
                </div>
                {!role && (
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    Please choose a role before continuing.
                  </p>
                )}
              </>
            )}

            {mode !== "choose" && (
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                {role ? ROLE_LABEL[role] : "Change role"}
              </button>
            )}

            {mode === "login" && loginStep === "credentials" && (
              <>
                <h2 className="font-display text-xl font-bold">Login</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign in with your registered email address and password.
                </p>
                <form
                  className="mt-5 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void doLogin();
                  }}
                >
                  <Field label="Registered email ID" required>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@college.edu.in"
                      className="field"
                      autoComplete="username"
                      type="email"
                    />
                  </Field>
                  <Field label="Password" required>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="field pr-10"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Field>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                    Login
                  </Button>
                </form>
                <div className="mt-4 text-center text-xs">
                  <button className="font-medium text-primary" onClick={() => setLoginStep("forgot")}>
                    Forgot password?
                  </button>
                </div>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  New here?{" "}
                  <button className="font-semibold text-primary" onClick={() => setMode("signup")}>
                    Create an account
                  </button>
                </p>
              </>
            )}

            {mode === "login" && loginStep === "forgot" && (
              <>
                <h2 className="font-display text-xl font-bold">Forgot password</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your registered email ID. You will answer one of the two security questions you set when
                  you signed up.
                </p>
                <div className="mt-5 space-y-4">
                  <Field label="Registered email ID" required>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className="field" type="email" />
                  </Field>
                  <Button className="w-full" disabled={busy} onClick={() => void loadQuestions()}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    Continue
                  </Button>
                  <button
                    className="w-full text-center text-xs font-medium text-primary"
                    onClick={() => setLoginStep("credentials")}
                  >
                    Back to login
                  </button>
                </div>
              </>
            )}

            {mode === "login" && loginStep === "forgot-answer" && (
              <>
                <h2 className="font-display text-xl font-bold">Answer a security question</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Answer one of your own questions and set a new password.
                </p>
                <div className="mt-5 space-y-4">
                  <Field label="Choose a question" required>
                    <select
                      className="field"
                      value={pickedQuestion}
                      onChange={(e) => setPickedQuestion(Number(e.target.value))}
                    >
                      {questions.map((q) => (
                        <option key={q.position} value={q.position}>
                          {q.question}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Your answer" required>
                    <input value={answer} onChange={(e) => setAnswer(e.target.value)} className="field" />
                  </Field>
                  <Field label="New password" required>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className="field pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm new password" required>
                    <input
                      type={showPw ? "text" : "password"}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      className="field"
                      autoComplete="new-password"
                    />
                  </Field>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Minimum 8 characters with an uppercase letter, a lowercase letter, a number and a special
                    character.
                  </p>
                  <Button className="w-full" disabled={busy} onClick={() => void confirmReset()}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Set new password
                  </Button>
                </div>
              </>
            )}

            {mode === "signup" && step === "email" && (
              <>
                <h2 className="font-display text-xl font-bold">Sign up as {role ? ROLE_LABEL[role] : ""}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your educational email ID (any valid, existing email works). It must not already be
                  registered.
                </p>
                <form
                  className="mt-5 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void doLookup();
                  }}
                >
                  <Field label="Educational email ID / registered email" required>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@college.edu.in"
                      className="field"
                      type="email"
                      autoComplete="email"
                    />
                  </Field>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    Continue
                  </Button>
                </form>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Already registered?{" "}
                  <button className="font-semibold text-primary" onClick={backToLogin}>
                    Go to Login
                  </button>
                </p>
              </>
            )}

            {mode === "signup" && step === "campus" && (
              <>
                <h2 className="font-display text-xl font-bold">Your university & campus</h2>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-secondary px-3 py-2.5 text-xs text-muted-foreground">
                  <Building2 className="mt-0.5 size-4 shrink-0" />
                  {recognized && institution ? (
                    <span>
                      Institution identified from your email:{" "}
                      <span className="font-semibold text-foreground">{institution.official_name}</span>
                    </span>
                  ) : (
                    <span>Search for your university or college, then pick the campus you study or work at.</span>
                  )}
                </div>
                <div className="mt-4 space-y-4">
                  <Field label="University / college" required>
                    <input
                      className="field"
                      value={instSearch}
                      onChange={(e) => void runInstSearch(e.target.value)}
                      placeholder="Search your college, university, city or state…"
                    />
                    {instResults.length > 0 && (
                      <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-border">
                        {instResults.map((i) => (
                          <button
                            key={i.id}
                            type="button"
                            onClick={() => void pickInstitution(i.id)}
                            className="block w-full px-3 py-2 text-left text-xs hover:bg-secondary"
                          >
                            <span className="font-medium">{i.official_name}</span>
                            <span className="block text-[10px] text-muted-foreground">
                              {[i.city, i.state].filter(Boolean).join(", ")}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {institution ? (
                      <p className="mt-1.5 text-[11px] font-medium text-success">
                        Selected: {institution.official_name}
                      </p>
                    ) : null}
                  </Field>

                  <Field label="Campus" required>
                    <input
                      className="field"
                      value={campusSearch}
                      onChange={(e) => setCampusSearch(e.target.value)}
                      placeholder={institution ? "Search campuses…" : "Select a university first"}
                      disabled={!institution}
                    />
                    <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-border">
                      {visibleCampuses.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-muted-foreground">
                          {institution ? "No campuses match your search." : "Choose your university above."}
                        </p>
                      ) : (
                        visibleCampuses.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setCampusId(c.id)}
                            className={cn(
                              "block w-full px-3 py-2 text-left text-xs hover:bg-secondary",
                              campusId === c.id && "bg-primary-soft text-primary",
                            )}
                          >
                            <span className="font-medium">{c.campus_name}</span>
                            {c.city ? <span className="block text-[10px] text-muted-foreground">{c.city}</span> : null}
                          </button>
                        ))
                      )}
                    </div>
                  </Field>

                  <Field label="Full name" required>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="field" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Mobile number">
                      <input
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className="field"
                        inputMode="numeric"
                      />
                    </Field>
                    {role === "student" && (
                      <Field label="PRN">
                        <input value={prn} onChange={(e) => setPrn(e.target.value)} className="field" />
                      </Field>
                    )}
                  </div>
                  <Button className="w-full" onClick={goToSecurity}>
                    Continue
                  </Button>
                </div>
              </>
            )}

            {mode === "signup" && step === "security" && (
              <>
                <h2 className="font-display text-xl font-bold">Set your security questions</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Write two questions and answers of your own choice. If you forget your password, answering one of
                  them lets you set a new one.
                </p>
                <div className="mt-5 space-y-4">
                  <Field label="Security question 1" required>
                    <input
                      className="field"
                      value={q1}
                      onChange={(e) => setQ1(e.target.value)}
                      placeholder="e.g. What was my first school's name?"
                      maxLength={160}
                    />
                  </Field>
                  <Field label="Answer 1" required>
                    <input className="field" value={a1} onChange={(e) => setA1(e.target.value)} maxLength={120} />
                  </Field>
                  <Field label="Security question 2" required>
                    <input
                      className="field"
                      value={q2}
                      onChange={(e) => setQ2(e.target.value)}
                      placeholder="e.g. What is my favourite sport?"
                      maxLength={160}
                    />
                  </Field>
                  <Field label="Answer 2" required>
                    <input className="field" value={a2} onChange={(e) => setA2(e.target.value)} maxLength={120} />
                  </Field>
                  <p className="text-[11px] text-muted-foreground">Answers are not case sensitive.</p>
                  <Button className="w-full" onClick={goToPassword}>
                    Continue
                  </Button>
                </div>
              </>
            )}

            {mode === "signup" && step === "password" && (
              <>
                <h2 className="font-display text-xl font-bold">Create your password</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This is the password you will use with <span className="font-medium text-foreground">{email}</span>.
                </p>
                <div className="mt-5 space-y-4">
                  <Field label="Create password" required>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className="field pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm password" required>
                    <input
                      type={showPw ? "text" : "password"}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      className="field"
                      autoComplete="new-password"
                    />
                  </Field>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Minimum 8 characters with an uppercase letter, a lowercase letter, a number and a special
                    character.
                  </p>
                  <Button className="w-full" disabled={busy} onClick={() => void completeRegistration()}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Create account
                  </Button>
                </div>
              </>
            )}

            {mode === "signup" && step === "done" && (
              <div className="py-4 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-success-soft text-success">
                  <CheckCircle2 className="size-6" />
                </span>
                <h2 className="mt-4 font-display text-xl font-bold">Registration successful</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {role === "student"
                    ? "Your account is ready. Please sign in with your email ID and password."
                    : "Your account has been created and is awaiting approval by an authorised approver."}
                </p>
                <Button className="mt-5 w-full" onClick={backToLogin}>
                  Go to Login
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label} {required ? <span className="text-danger">*</span> : null}
      </span>
      {children}
    </label>
  );
}
