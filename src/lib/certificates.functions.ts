import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface RatingTarget {
  kind: "college" | "industrial";
  label: string;
  rated: boolean;
}

export interface CertificateRecord {
  certificate_id: string;
  student_name: string;
  team_name: string;
  institution: string;
  cycle_year: number;
  ps_id: string | null;
  ps_title: string | null;
  issued_at: string;
}

export interface CertificateState {
  team: { id: string; name: string; finalized: boolean; process_completed: boolean; member_count: number } | null;
  targets: RatingTarget[];
  teamRatingsComplete: boolean;
  eligible: boolean;
  blockers: string[];
  certificate: CertificateRecord | null;
}

const ratingSchema = z.object({
  mentorKind: z.enum(["college", "industrial"]),
  overall: z.number().int().min(1).max(5),
  guidance: z.number().int().min(1).max(5),
  availability: z.number().int().min(1).max(5),
  technical: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  helpfulness: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(1000).optional(),
});

async function loadContext(supabase: any, userId: string) {
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const teamId =
    membership?.team_id ??
    (await supabase.from("teams").select("id").eq("leader_id", userId).limit(1).maybeSingle()).data?.id ??
    null;
  if (!teamId) return null;
  const [{ data: team }, { data: members }, { data: ratings }] = await Promise.all([
    supabase.from("teams").select("*").eq("id", teamId).maybeSingle(),
    supabase.from("team_members").select("user_id, member_name").eq("team_id", teamId),
    supabase.from("mentor_ratings").select("rater_user_id, mentor_kind").eq("team_id", teamId),
  ]);
  return { team, members: members ?? [], ratings: ratings ?? [] };
}

/** Everything the student dashboard needs to decide whether a certificate is unlocked. */
export const getCertificateState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CertificateState> => {
    const { supabase, userId } = context;
    const ctx = await loadContext(supabase, userId);
    const { data: cert } = await supabase
      .from("certificates")
      .select("certificate_id, student_name, team_name, institution, cycle_year, ps_id, ps_title, issued_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!ctx?.team) {
      return {
        team: null,
        targets: [],
        teamRatingsComplete: false,
        eligible: false,
        blockers: ["Create your team of 6 members to begin."],
        certificate: (cert as CertificateRecord) ?? null,
      };
    }

    const team = ctx.team;
    const targets: RatingTarget[] = [];
    if (team.assigned_mentor_id) {
      const { data: mentor } = await supabase.from("mentors").select("name").eq("id", team.assigned_mentor_id).maybeSingle();
      targets.push({
        kind: "college",
        label: mentor?.name ?? "Assigned college mentor",
        rated: ctx.ratings.some((r: any) => r.rater_user_id === userId && r.mentor_kind === "college"),
      });
    }
    if (team.industrial_mentor_user_id) {
      const { data: im } = await supabase
        .from("industrial_mentor_profiles")
        .select("full_name, company")
        .eq("user_id", team.industrial_mentor_user_id)
        .maybeSingle();
      targets.push({
        kind: "industrial",
        label: im ? `${im.full_name} · ${im.company}` : "Industrial mentor",
        rated: ctx.ratings.some((r: any) => r.rater_user_id === userId && r.mentor_kind === "industrial"),
      });
    }

    const memberIds = ctx.members.map((m: any) => m.user_id);
    const teamRatingsComplete =
      targets.length > 0 &&
      memberIds.length === 6 &&
      targets.every((t) =>
        memberIds.every((id: string) => ctx.ratings.some((r: any) => r.rater_user_id === id && r.mentor_kind === t.kind)),
      );

    const blockers: string[] = [];
    if (memberIds.length !== 6) blockers.push("Your team must have exactly 6 finalised members.");
    if (!team.finalized) blockers.push("Team registration is not finalised yet.");
    if (!team.process_completed) blockers.push("The Internal SIH process for your team is not marked complete yet.");
    if (!targets.length) blockers.push("No mentor is linked to your team yet.");
    else if (!teamRatingsComplete) blockers.push("Every team member must complete the required mentor feedback.");

    return {
      team: {
        id: team.id,
        name: team.name,
        finalized: team.finalized,
        process_completed: team.process_completed,
        member_count: memberIds.length,
      },
      targets,
      teamRatingsComplete,
      eligible: blockers.length === 0,
      certificate: (cert as CertificateRecord) ?? null,
      blockers,
    };
  });

/** Saves one team member's feedback for one mentor. */
export const submitMentorRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ratingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await loadContext(supabase, userId);
    if (!ctx?.team) throw new Error("You are not part of a team yet.");
    if (data.mentorKind === "college" && !ctx.team.assigned_mentor_id)
      throw new Error("No college mentor is assigned to your team.");
    if (data.mentorKind === "industrial" && !ctx.team.industrial_mentor_user_id)
      throw new Error("Your team has not worked with an industrial mentor.");

    const { error } = await supabase.from("mentor_ratings").upsert(
      {
        team_id: ctx.team.id,
        rater_user_id: userId,
        mentor_kind: data.mentorKind,
        overall: data.overall,
        guidance: data.guidance,
        availability: data.availability,
        technical: data.technical,
        communication: data.communication,
        helpfulness: data.helpfulness,
        feedback: data.feedback ?? "",
      },
      { onConflict: "team_id,rater_user_id,mentor_kind" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Issues this student's own certificate. Eligibility is re-checked on the server,
 * so visiting a URL can never produce a certificate.
 */
export const issueMyCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CertificateRecord> => {
    const { supabase, userId } = context;
    const ctx = await loadContext(supabase, userId);
    if (!ctx?.team) throw new Error("You are not part of a team yet.");

    const memberIds = ctx.members.map((m: any) => m.user_id);
    if (memberIds.length !== 6) throw new Error("Your team must have exactly 6 finalised members.");
    if (!ctx.team.finalized || !ctx.team.process_completed)
      throw new Error("The Internal SIH process for your team is not complete yet.");

    const kinds: ("college" | "industrial")[] = [];
    if (ctx.team.assigned_mentor_id) kinds.push("college");
    if (ctx.team.industrial_mentor_user_id) kinds.push("industrial");
    if (!kinds.length) throw new Error("No mentor is linked to your team yet.");
    const complete = kinds.every((k) =>
      memberIds.every((id: string) => ctx.ratings.some((r: any) => r.rater_user_id === id && r.mentor_kind === k)),
    );
    if (!complete) throw new Error("Every team member must complete the required mentor feedback first.");

    const { data: existing } = await supabase
      .from("certificates")
      .select("certificate_id, student_name, team_name, institution, cycle_year, ps_id, ps_title, issued_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return existing as CertificateRecord;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, institution_id, campus")
      .eq("id", userId)
      .maybeSingle();
    let institution = profile?.campus ?? "";
    if (profile?.institution_id) {
      const { data: inst } = await supabaseAdmin
        .from("institutions")
        .select("official_name")
        .eq("id", profile.institution_id)
        .maybeSingle();
      institution = inst?.official_name ?? institution;
    }

    const year = ctx.team.cycle_year ?? new Date().getUTCFullYear();
    const { count } = await supabaseAdmin
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .eq("cycle_year", year);
    const certificateId = `ISIH-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;

    const insert = await supabaseAdmin
      .from("certificates")
      .insert({
        certificate_id: certificateId,
        user_id: userId,
        team_id: ctx.team.id,
        cycle_year: year,
        student_name: profile?.full_name ?? "",
        team_name: ctx.team.name,
        institution,
        ps_id: ctx.team.selected_ps_id,
        ps_title: ctx.team.selected_ps_title,
      })
      .select("certificate_id, student_name, team_name, institution, cycle_year, ps_id, ps_title, issued_at")
      .single();
    if (insert.error || !insert.data) throw new Error(insert.error?.message ?? "Could not issue your certificate.");
    return insert.data as CertificateRecord;
  });
