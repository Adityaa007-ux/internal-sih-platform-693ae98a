import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDeadlines } from "@/lib/admin.functions";

export interface DeadlineRow {
  id: string;
  label: string;
  description: string;
  due_at: string;
}

/**
 * Fallback timeline used when no deadlines are published yet.
 * Dates are derived from the real current date so the timeline always stays
 * live and continuous (some milestones completed, the rest upcoming).
 */
const FALLBACK: { label: string; description: string; offsetDays: number }[] = [
  { label: "Team registration closes", description: "Teams of six members must be finalised.", offsetDays: -28 },
  { label: "Problem statement selection", description: "Each team locks one problem statement.", offsetDays: -21 },
  { label: "Proposal submission deadline", description: "Final proposal upload for AI analysis.", offsetDays: -14 },
  { label: "Faculty review window closes", description: "Faculty evaluation scores recorded.", offsetDays: -7 },
  { label: "Shortlist publication", description: "Shortlisted teams announced.", offsetDays: -1 },
  { label: "Offline faculty presentation", description: "Shortlisted teams present to the panel.", offsetDays: 12 },
  { label: "Final result publication", description: "Selected teams announced.", offsetDays: 18 },
];

function fallbackRows(now: Date): DeadlineRow[] {
  return FALLBACK.map((d, i) => {
    const due = new Date(now);
    due.setHours(17, 0, 0, 0);
    due.setDate(due.getDate() + d.offsetDays);
    return { id: `auto-${i}`, label: d.label, description: d.description, due_at: due.toISOString() };
  });
}

/** Single source of truth for deadlines across the dashboard and Deadlines page. */
export function useDeadlines() {
  const fetchDeadlines = useServerFn(listDeadlines);
  const query = useQuery({
    queryKey: ["deadlines"],
    queryFn: () => fetchDeadlines(),
    // Keep the timeline in sync with real time.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const remote = (query.data as DeadlineRow[] | undefined) ?? [];
  const rows = remote.length > 0 ? remote : fallbackRows(new Date());
  const sorted = [...rows].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

  return { rows: sorted, isLoading: query.isLoading };
}
