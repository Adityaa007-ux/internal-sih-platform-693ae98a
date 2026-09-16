import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEMO_ANNOUNCEMENTS,
  DEMO_TEAMS,
  type AiAnalysis,
  type Announcement,
  type FacultyReview,
  type Presentation,
  type Proposal,
  type Role,
  type ShortlistStatus,
  type SimilarityResult,
  type Team,
  type TeamStage,
} from "./demo-data";
import { demoTeamIdFor, normaliseEmail } from "./demo-access";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "isih-workspace-v2";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  date: string;
  read: boolean;
}

interface PersistedState {
  role: Role;
  teams: Team[];
  currentTeamId: string | null;
  announcements: Announcement[];
  notifications: NotificationItem[];
  resultsPublished: boolean;
}

interface StoreValue extends PersistedState {
  hydrated: boolean;
  currentTeam: Team | null;
  setRole: (r: Role) => void;
  setCurrentTeamId: (id: string | null) => void;
  registerTeam: (t: Omit<Team, "id" | "regId" | "createdAt">) => Team;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  selectProblem: (teamId: string, problemId: string) => void;
  saveProposal: (teamId: string, proposal: Proposal, submit: boolean) => void;
  setAnalysis: (teamId: string, a: AiAnalysis) => void;
  setSimilarity: (teamId: string, s: SimilarityResult) => void;
  saveReview: (teamId: string, r: FacultyReview) => void;
  setShortlist: (teamId: string, s: ShortlistStatus) => void;
  schedulePresentation: (teamId: string, p: Presentation) => void;
  recordFinalResult: (teamId: string, result: "Selected" | "Not Selected", score: number, remarks: string) => void;
  publishResults: (v: boolean) => void;
  addAnnouncement: (a: Omit<Announcement, "id" | "date">) => void;
  pushNotification: (title: string, body: string) => void;
  markAllRead: () => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const stageRank: Record<TeamStage, number> = {
  Registration: 0,
  "Problem Selection": 1,
  "Proposal Submission": 2,
  "AI Analysis": 3,
  "Faculty Review": 4,
  Shortlist: 5,
  "Offline Presentation": 6,
  "Final Result": 7,
};

const advance = (current: TeamStage, next: TeamStage): TeamStage =>
  stageRank[next] > stageRank[current] ? next : current;

function blankState(): PersistedState {
  return {
    role: "student",
    teams: [],
    currentTeamId: null,
    announcements: [],
    notifications: [],
    resultsPublished: false,
  };
}

function demoState(teamId: string): PersistedState {
  return {
    role: "student",
    teams: DEMO_TEAMS,
    currentTeamId: teamId,
    announcements: DEMO_ANNOUNCEMENTS,
    notifications: DEMO_ANNOUNCEMENTS.slice(0, 4).map((a, i) => ({
      id: `N-${a.id}`,
      title: a.title,
      body: a.body,
      date: a.date,
      read: i > 1,
    })),
    resultsPublished: false,
  };
}

function initialState(): PersistedState {
  return blankState();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  // The workspace is per-account. Demo content only exists for the fixed demo
  // addresses; every other account starts completely blank.
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const email = normaliseEmail(data.session?.user?.email);
      const demoTeam = demoTeamIdFor(email);
      const key = `${STORAGE_KEY}:${email || "guest"}`;
      const base = demoTeam ? demoState(demoTeam) : blankState();
      let next = base;
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) next = { ...base, ...(JSON.parse(raw) as PersistedState) };
      } catch {
        /* ignore corrupt local state */
      }
      setState(next);
      setStorageKey(key);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* storage full / unavailable */
    }
  }, [state, hydrated, storageKey]);

  const patchTeam = useCallback((id: string, fn: (t: Team) => Team) => {
    setState((s) => ({ ...s, teams: s.teams.map((t) => (t.id === id ? fn(t) : t)) }));
  }, []);

  const pushNotification = useCallback((title: string, body: string) => {
    setState((s) => ({
      ...s,
      notifications: [
        { id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, body, date: new Date().toISOString(), read: false },
        ...s.notifications,
      ].slice(0, 40),
    }));
  }, []);

  const value = useMemo<StoreValue>(() => {
    const currentTeam = state.teams.find((t) => t.id === state.currentTeamId) ?? null;

    return {
      ...state,
      hydrated,
      currentTeam,
      setRole: (role) => setState((s) => ({ ...s, role })),
      setCurrentTeamId: (currentTeamId) => setState((s) => ({ ...s, currentTeamId })),

      registerTeam: (data) => {
        const n = state.teams.length + 1;
        const team: Team = {
          ...data,
          id: `T-${String(n).padStart(3, "0")}`,
          regId: `ISIH-2026-${String(n).padStart(4, "0")}`,
          createdAt: new Date().toISOString(),
        };
        setState((s) => ({ ...s, teams: [...s.teams, team], currentTeamId: team.id }));
        pushNotification("Team registered", `${team.name} registered successfully with ID ${team.regId}.`);
        return team;
      },

      updateTeam: (id, patch) => patchTeam(id, (t) => ({ ...t, ...patch })),

      selectProblem: (teamId, problemId) => {
        patchTeam(teamId, (t) => ({
          ...t,
          problemId,
          stage: advance(t.stage, "Problem Selection"),
        }));
        pushNotification("Problem statement selected", `${problemId} is now linked to your team.`);
      },

      saveProposal: (teamId, proposal, submit) => {
        patchTeam(teamId, (t) => ({
          ...t,
          proposal,
          proposalStatus: submit ? "Submitted" : "Draft",
          stage: submit ? advance(t.stage, "Proposal Submission") : t.stage,
        }));
        pushNotification(
          submit ? "Proposal submitted" : "Draft saved",
          submit
            ? "Your proposal has been submitted for AI analysis and faculty review."
            : "Your proposal draft has been saved. It is not yet submitted.",
        );
      },

      setAnalysis: (teamId, ai) => {
        patchTeam(teamId, (t) => ({
          ...t,
          ai,
          proposalStatus: t.proposalStatus === "Draft" || t.proposalStatus === "Not Started" ? t.proposalStatus : "Under AI Analysis",
          stage: advance(t.stage, "AI Analysis"),
        }));
        pushNotification("AI analysis complete", `Proposal quality score: ${ai.overall}/100.`);
      },

      setSimilarity: (teamId, similarity) => {
        patchTeam(teamId, (t) => ({ ...t, similarity, stage: advance(t.stage, "AI Analysis") }));
        pushNotification("Similarity check complete", `Similarity ${similarity.score}% — risk: ${similarity.risk}.`);
      },

      saveReview: (teamId, review) => {
        patchTeam(teamId, (t) => ({
          ...t,
          review,
          proposalStatus: "Under Faculty Review",
          stage: advance(t.stage, "Faculty Review"),
        }));
        pushNotification("Faculty evaluation recorded", `Score ${review.total}/60 saved by ${review.reviewer}.`);
      },

      setShortlist: (teamId, shortlist) => {
        patchTeam(teamId, (t) => ({
          ...t,
          shortlist,
          proposalStatus: shortlist === "Shortlisted" ? "Shortlisted" : t.proposalStatus,
          stage: shortlist === "Shortlisted" ? advance(t.stage, "Shortlist") : t.stage,
        }));
        pushNotification("Shortlist updated", `Team status changed to "${shortlist}".`);
      },

      schedulePresentation: (teamId, presentation) => {
        patchTeam(teamId, (t) => ({
          ...t,
          presentation,
          proposalStatus: "Presentation",
          stage: advance(t.stage, "Offline Presentation"),
        }));
        pushNotification("Presentation scheduled", `${presentation.date} at ${presentation.time}, ${presentation.venue}.`);
      },

      recordFinalResult: (teamId, result, finalScore, remarks) => {
        patchTeam(teamId, (t) => ({
          ...t,
          presentation: {
            ...(t.presentation ?? { date: "", time: "", venue: "", panel: "", status: "Completed", remarks: "" }),
            status: "Completed",
            remarks,
            finalResult: result,
            finalScore,
          },
          proposalStatus: result === "Selected" ? "Selected" : "Not Selected",
          stage: "Final Result",
        }));
        pushNotification("Final evaluation recorded", `Panel marked the team as ${result}.`);
      },

      publishResults: (resultsPublished) => {
        setState((s) => ({ ...s, resultsPublished }));
        if (resultsPublished) pushNotification("Results published", "Internal SIH 2026 final results are now visible to all users.");
      },

      addAnnouncement: (a) => {
        const item: Announcement = { ...a, id: `A-${Date.now()}`, date: new Date().toISOString() };
        setState((s) => ({ ...s, announcements: [item, ...s.announcements] }));
        pushNotification(a.title, a.body);
      },

      pushNotification,
      markAllRead: () => setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      resetDemo: () => {
        setState(initialState());
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* noop */
        }
      },
    };
  }, [state, hydrated, patchTeam, pushNotification]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

// Combined ranking used by the shortlist page and analytics.
export function combinedScore(t: Team): number {
  const ai = t.ai?.overall ?? 0;
  const fac = t.review ? (t.review.total / 60) * 100 : 0;
  const simPenalty = t.similarity ? Math.max(0, (t.similarity.score - 55) * 0.35) : 0;
  const weighted = t.review ? ai * 0.45 + fac * 0.55 : ai * 0.7;
  return Math.max(0, Math.round((weighted - simPenalty) * 10) / 10);
}
