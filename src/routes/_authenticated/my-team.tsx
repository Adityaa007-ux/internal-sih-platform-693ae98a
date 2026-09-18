import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, Briefcase, Lock, Users } from "lucide-react";
import { getMyTeam } from "@/lib/team.functions";
import { EmptyState, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/my-team")({
  head: () => ({
    meta: [
      { title: "My Team — Internal SIH Platform" },
      {
        name: "description",
        content: "View your Internal SIH team profile, locked member list, mentors and selected problem statement.",
      },
      { property: "og:title", content: "My Team — Internal SIH Platform" },
      { property: "og:description", content: "Team profile and selection progress in the Internal SIH Platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyTeam,
});

function MyTeam() {
  const fetchTeam = useServerFn(getMyTeam);
  const { data, isLoading } = useQuery({ queryKey: ["my-team"], queryFn: () => fetchTeam() });
  const { currentTeam, hydrated } = useStore();

  if (isLoading || !hydrated) return <p className="text-sm text-muted-foreground">Loading your team…</p>;

  // Demo accounts keep their pre-seeded workspace team when no live team exists.
  if (!data?.team && currentTeam) return <DemoTeamView team={currentTeam} />;

  if (!data?.team) {
    return (
      <EmptyState
        icon={Users}
        title="No team registered yet"
        description="Register your team of six members — including at least one female member — to start the Internal SIH process."
        action={
          <Button asChild>
            <Link to="/team-registration">Register a team</Link>
          </Button>
        }
      />
    );
  }

  const team = data.team;

  return (
    <div className="space-y-6">
      <PageHeader
        title={team.name}
        description={`${team.code}${team.campus ? ` · ${team.campus}` : ""}${team.department ? ` · ${team.department}` : ""}`}
        icon={Users}
        actions={
          <>
            {team.finalized ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
                <Lock className="size-3.5" /> Membership locked
              </span>
            ) : null}
            <Button asChild variant="outline">
              <Link to="/certificates">
                <Award className="size-4" /> Certificate
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card overflow-hidden lg:col-span-2">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-sm font-semibold">Team members ({data.members.length}/6)</h2>
          </div>
          <ul className="divide-y divide-border">
            {data.members.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft font-display text-xs font-bold text-primary">
                  {(m.member_name || "?")
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {m.member_name}
                    {m.is_leader ? <span className="ml-2 text-[10px] font-bold uppercase text-primary">Leader</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[m.prn, m.department, m.year, m.gender].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{m.email}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="surface-card p-5">
            <h2 className="font-display text-sm font-semibold">Mentors</h2>
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">College mentor: </span>
              {data.collegeMentor ?? "Not assigned yet"}
            </p>
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Industrial mentor: </span>
              {data.industrialMentor ?? "Not connected yet"}
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link to="/industrial-mentor">
                <Briefcase className="size-4" /> Find an industrial mentor
              </Link>
            </Button>
          </div>

          <div className="surface-card p-5">
            <h2 className="font-display text-sm font-semibold">Problem statement</h2>
            {team.selected_ps_id ? (
              <div className="mt-3">
                <span className="rounded-md bg-primary-soft px-2 py-0.5 font-display text-xs font-bold text-primary">
                  {team.selected_ps_id}
                </span>
                <p className="mt-2 text-sm font-medium">{team.selected_ps_title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{team.selected_ps_org}</p>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">Not selected yet.</p>
                <Button asChild size="sm" className="mt-3">
                  <Link to="/repository">Choose a problem</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
