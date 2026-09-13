// Server-only helpers for the Internal SIH annual cycle calendar.
// Official dates are never invented here: they come from a verified record that
// an authorised admin/faculty member confirms, or from an automated check of the
// official Smart India Hackathon site.

export const OFFICIAL_SOURCE = "https://www.sih.gov.in/";
/** The internal platform opens one month before the official process starts. */
export const ACTIVATION_LEAD_DAYS = 30;
/** Cycle data stays available for one month after the official process ends. */
export const CLOSURE_DAYS = 30;

export interface CycleRow {
  id: string;
  edition_year: number;
  edition_label: string;
  official_start: string | null;
  official_end: string | null;
  source_url: string;
  verified: boolean;
  verified_at: string | null;
  last_checked_at: string | null;
  check_status: string;
  check_note: string;
}

export type CyclePhase = "unscheduled" | "waiting" | "active" | "closure" | "reset-due";

export interface CycleStatus {
  cycle: CycleRow | null;
  phase: CyclePhase;
  activationDate: string | null;
  closureEndDate: string | null;
  /** True when students/mentors may run cycle workflows. */
  open: boolean;
  message: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today in Asia/Kolkata, as YYYY-MM-DD — SIH operations run on Indian time. */
export function todayIST(): string {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export function describeCycle(cycle: CycleRow | null): CycleStatus {
  if (!cycle || !cycle.official_start || !cycle.official_end) {
    return {
      cycle,
      phase: "unscheduled",
      activationDate: null,
      closureEndDate: null,
      open: false,
      message:
        "The next Internal SIH cycle is not currently active. The platform will open automatically according to the official Smart India Hackathon calendar.",
    };
  }
  const today = todayIST();
  const activation = addDays(cycle.official_start, -ACTIVATION_LEAD_DAYS);
  const closureEnd = addDays(cycle.official_end, CLOSURE_DAYS);

  let phase: CyclePhase;
  if (today < activation) phase = "waiting";
  else if (today <= cycle.official_end) phase = "active";
  else if (today <= closureEnd) phase = "closure";
  else phase = "reset-due";

  const message =
    phase === "waiting"
      ? `The Internal SIH cycle opens on ${activation} (one month before the official process starts on ${cycle.official_start}).`
      : phase === "active"
          ? `The current Internal SIH cycle is active. The official process runs until ${cycle.official_end}.`
        : phase === "closure"
          ? `The official process has ended. Records stay available for closure tasks until ${closureEnd}.`
          : "The closure period has ended. Cycle data is being reset for the next edition.";

  return {
    cycle,
    phase,
    activationDate: activation,
    closureEndDate: closureEnd,
    open: phase === "active" || phase === "closure",
    message,
  };
}

/**
 * Reads the official Smart India Hackathon site and reports whether an edition
 * later than the one we hold is announced. Dates are never guessed: if the page
 * cannot be parsed for explicit dates we only flag it for human confirmation.
 */
export async function probeOfficialCalendar(knownYear: number): Promise<{
  status: "ok" | "needs-review" | "unreachable";
  note: string;
  detectedYear: number | null;
}> {
  try {
    const res = await fetch(OFFICIAL_SOURCE, {
      headers: { "user-agent": "InternalSIHPlatform/1.0 (+calendar-sync)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { status: "unreachable", note: `Official site returned ${res.status}.`, detectedYear: null };
    const html = (await res.text()).replace(/<[^>]+>/g, " ");
    const years = [...html.matchAll(/\bSIH\s*(20\d{2})\b/gi)].map((m) => Number(m[1]));
    const detectedYear = years.length ? Math.max(...years) : null;
    if (detectedYear && detectedYear > knownYear) {
      return {
        status: "needs-review",
        note: `The official site mentions SIH ${detectedYear}. Confirm the published start and end dates and update the cycle.`,
        detectedYear,
      };
    }
    return { status: "ok", note: "Official site checked; no newer edition detected.", detectedYear };
  } catch (err) {
    return {
      status: "unreachable",
      note: `Could not read the official calendar (${err instanceof Error ? err.message : "network error"}). Last verified schedule kept.`,
      detectedYear: null,
    };
  }
}
