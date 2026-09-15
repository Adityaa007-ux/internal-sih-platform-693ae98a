import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ROLES = ["student", "faculty", "mentor", "admin"] as const;
export type PortalRole = (typeof ROLES)[number];

const questionSchema = z.object({
  question: z.string().trim().min(8, "Write a question of at least 8 characters.").max(160),
  answer: z.string().trim().min(2, "Answer must be at least 2 characters.").max(120),
});

const registerSchema = z.object({
  role: z.enum(ROLES),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  fullName: z.string().trim().min(3, "Enter your full name.").max(120),
  mobile: z.string().trim().max(20).optional(),
  prn: z.string().trim().max(30).optional(),
  institutionId: z.string().uuid("Select your institution."),
  campusId: z.string().uuid("Select your campus."),
  password: z.string().min(1),
  confirmPassword: z.string().min(1),
  questions: z.array(questionSchema).length(2, "Set both security questions."),
});

function strong(value: string): string | null {
  if (value.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(value)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(value)) return "Password must contain a lowercase letter.";
  if (!/\d/.test(value)) return "Password must contain a number.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Password must contain a special character.";
  return null;
}

async function hashAnswer(email: string, answer: string): Promise<string> {
  const pepper = process.env["OTP_PEPPER"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "internal-sih";
  const normalized = answer.trim().toLowerCase().replace(/\s+/g, " ");
  const bytes = new TextEncoder().encode(`${email}:${normalized}:${pepper}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Step 1 of sign up — the email must be a valid, unused address. */
export const checkEmailAvailable = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (existing) throw new Error("An account already exists with this email. Please log in instead.");
    return { ok: true, email: data.email };
  });

export interface RegisterResult {
  role: PortalRole;
  approvalStatus: "approved" | "pending";
  email: string;
  fullName: string;
}

/** Creates the account directly — no email code step. */
export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }): Promise<RegisterResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.password !== data.confirmPassword) throw new Error("Passwords do not match.");
    const pwError = strong(data.password);
    if (pwError) throw new Error(pwError);
    if (data.questions[0]!.question.trim().toLowerCase() === data.questions[1]!.question.trim().toLowerCase())
      throw new Error("Your two security questions must be different.");

    const email = data.email;
    const mobile = data.mobile?.replace(/\D/g, "") || null;

    const { data: dupe } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (dupe) throw new Error("An account already exists with this email. Please log in instead.");

    const { data: campus } = await supabaseAdmin
      .from("campuses")
      .select("id, institution_id, campus_name")
      .eq("id", data.campusId)
      .maybeSingle();
    if (!campus || campus.institution_id !== data.institutionId)
      throw new Error("The selected campus is not valid for this institution.");

    const { count: staffCount } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .in("role", ["admin", "faculty"]);
    const bootstrap = (staffCount ?? 0) === 0;
    const approvalStatus: "approved" | "pending" =
      data.role === "student" ? "approved" : bootstrap && data.role !== "mentor" ? "approved" : "pending";

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName.trim(), role: data.role },
    });
    if (created.error || !created.data.user)
      throw new Error(created.error?.message ?? "Could not create the account. Please try again.");
    const userId = created.data.user.id;

    const profile = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: data.fullName.trim(),
        email,
        auth_email: email,
        mobile,
        prn: data.prn?.trim().toUpperCase() || null,
        institution_id: data.institutionId,
        campus_id: campus.id,
        campus: campus.campus_name,
        verified_channel: "email",
        approval_status: approvalStatus,
        status: "active",
      },
      { onConflict: "id" },
    );
    if (profile.error) throw new Error(profile.error.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });

    await supabaseAdmin.from("security_questions").delete().eq("user_id", userId);
    await supabaseAdmin.from("security_questions").insert(
      await Promise.all(
        data.questions.map(async (q, i) => ({
          user_id: userId,
          email,
          position: i + 1,
          question: q.question.trim(),
          answer_hash: await hashAnswer(email, q.answer),
        })),
      ),
    );

    await supabaseAdmin.from("audit_log").insert({
      actor: userId,
      actor_label: data.fullName.trim(),
      action: "account.signup",
      detail: `${data.role} account created (${approvalStatus})`,
    });

    return { role: data.role, approvalStatus, email, fullName: data.fullName.trim() };
  });

/** Forgot password step 1 — the questions this user chose for themselves. */
export const getSecurityQuestions = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") }).parse(data),
  )
  .handler(async ({ data }): Promise<{ questions: { position: number; question: string }[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("security_questions")
      .select("position, question")
      .eq("email", data.email)
      .order("position");
    if (!rows || rows.length === 0)
      throw new Error("No security questions are set for this email. Please contact the coordination cell.");
    return { questions: rows.map((r) => ({ position: Number(r.position), question: r.question })) };
  });

/** Forgot password step 2 — answer one question, set a new password. */
export const resetPasswordWithAnswer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email("Enter a valid email address."),
        position: z.number().int().min(1).max(2),
        answer: z.string().trim().min(1, "Enter your answer."),
        password: z.string().min(1),
        confirmPassword: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.password !== data.confirmPassword) throw new Error("Passwords do not match.");
    const pwError = strong(data.password);
    if (pwError) throw new Error(pwError);

    const { data: row } = await supabaseAdmin
      .from("security_questions")
      .select("user_id, answer_hash")
      .eq("email", data.email)
      .eq("position", data.position)
      .maybeSingle();
    if (!row) throw new Error("We could not find that security question.");
    if ((await hashAnswer(data.email, data.answer)) !== row.answer_hash)
      throw new Error("That answer does not match. Please try again.");

    const upd = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password: data.password });
    if (upd.error) throw new Error("Could not update your password. Please try again.");
    await supabaseAdmin.from("audit_log").insert({
      actor: row.user_id,
      actor_label: data.email,
      action: "account.password_reset",
      detail: "Password reset using a security question",
    });
    return { ok: true };
  });
