import type { PortalRole } from "./auth.functions";

const KEY = "isih-active-role";
const VALID: PortalRole[] = ["student", "faculty", "mentor", "admin"];

export function setActiveRole(role: PortalRole): void {
  try {
    window.localStorage.setItem(KEY, role);
  } catch {
    /* storage unavailable */
  }
}

export function getActiveRole(): PortalRole | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v && (VALID as string[]).includes(v) ? (v as PortalRole) : null;
  } catch {
    return null;
  }
}

export function clearActiveRole(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
