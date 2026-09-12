// Runs unattended once a day: checks the official Smart India Hackathon calendar
// and, once a finished cycle passes its one-month closure period, resets the
// cycle-specific operational data while keeping every feature, master list and
// configuration intact.

import { describeCycle, probeOfficialCalendar, type CycleRow } from "./cycle.server";

export interface MaintenanceReport {
  checked: boolean;
  checkStatus: string;
  note: string;
  reset: boolean;
  resetYear: number | null;
  removed: Record<string, number>;
}

export async function runCycleMaintenance(): Promise<MaintenanceReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const report: MaintenanceReport = {
    checked: false,
    checkStatus: "no-cycle",
    note: "No cycle configured yet.",
    reset: false,
    resetYear: null,
    removed: {},
  };

  const { data } = await supabaseAdmin
    .from("sih_cycles")
    .select("*")
    .order("edition_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cycle = (data as CycleRow | null) ?? null;
  if (!cycle) return report;

  // 1. Official calendar check — never invents dates.
  const probe = await probeOfficialCalendar(cycle.edition_year);
  report.checked = true;
  report.checkStatus = probe.status;
  report.note = probe.note;
  await supabaseAdmin
    .from("sih_cycles")
    .update({ last_checked_at: new Date().toISOString(), check_status: probe.status, check_note: probe.note })
    .eq("id", cycle.id);

  // 2. Post-closure reset of cycle-specific operational data.
  const status = describeCycle(cycle);
  if (status.phase !== "reset-due") return report;

  const teamIds = ((await supabaseAdmin.from("teams").select("id")).data ?? []).map((t) => t.id);
  const requestIds = ((await supabaseAdmin.from("mentorship_requests").select("id")).data ?? []).map((r) => r.id);

  const count = (n: number | null) => n ?? 0;

  report.removed["mentor_messages"] = requestIds.length
    ? count((await supabaseAdmin.from("mentor_messages").delete({ count: "exact" }).in("request_id", requestIds)).count)
    : 0;
  report.removed["mentorship_requests"] = requestIds.length
    ? count((await supabaseAdmin.from("mentorship_requests").delete({ count: "exact" }).in("id", requestIds)).count)
    : 0;
  report.removed["mentor_ratings"] = teamIds.length
    ? count((await supabaseAdmin.from("mentor_ratings").delete({ count: "exact" }).in("team_id", teamIds)).count)
    : 0;
  report.removed["team_members"] = teamIds.length
    ? count((await supabaseAdmin.from("team_members").delete({ count: "exact" }).in("team_id", teamIds)).count)
    : 0;
  report.removed["teams"] = teamIds.length
    ? count((await supabaseAdmin.from("teams").delete({ count: "exact" }).in("id", teamIds)).count)
    : 0;

  await supabaseAdmin.from("audit_log").insert({
    actor_label: "System",
    action: "cycle.reset",
    detail: `Cycle ${cycle.edition_year} operational data reset after the closure period.`,
  });

  report.reset = true;
  report.resetYear = cycle.edition_year;
  return report;
}
