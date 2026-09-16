/**
 * Demo data is visible ONLY to this fixed list of accounts.
 * Every other account — new or existing — starts with a completely blank
 * workspace and must create its own data through the normal workflow.
 * Each demo address is bound to a different demo team.
 */
export const DEMO_EMAIL_TEAMS: Record<string, string> = {
  "shindeaditya57254@gmail.com": "T-001",
  "atharvaphadatare2007@gmail.com": "T-002",
  "swayamphadatare866@gmail.com": "T-003",
  "hariomrodage5@gmail.com": "T-004",
  "janhavi.shitole08@gmail.com": "T-005",
  "vedanshcse2007@gmail.com": "T-006",
};

export const DEMO_EMAILS = Object.keys(DEMO_EMAIL_TEAMS);

export function normaliseEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isDemoEmail(email: string | null | undefined): boolean {
  return normaliseEmail(email) in DEMO_EMAIL_TEAMS;
}

/** The demo team bound to this address, or null for a normal account. */
export function demoTeamIdFor(email: string | null | undefined): string | null {
  return DEMO_EMAIL_TEAMS[normaliseEmail(email)] ?? null;
}
