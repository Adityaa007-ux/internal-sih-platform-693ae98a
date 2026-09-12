import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { DEPARTMENTS } from "@/lib/demo-data";
import { createTeam, getMyTeam, TEAM_SIZE } from "@/lib/team.functions";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/team-registration")({
  head: () => ({
    meta: [
      { title: "Team Registration — Internal SIH Platform" },
      {
        name: "description",
        content:
          "Register your Internal SIH team: exactly six students including the leader and at least one female member, with PRN and contact details.",
      },
      { property: "og:title", content: "Team Registration — Internal SIH Platform" },
      { property: "og:description", content: "Register a team for the Internal Smart India Hackathon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamRegistration,
});

interface MemberForm {
  member_name: string;
  prn: string;
  email: string;
  mobile: string;
  gender: "female" | "male" | "other" | "";
  department: string;
  year: string;
}

const emptyMember = (): MemberForm => ({
  member_name: "",
  prn: "",
  email: "",
  mobile: "",
  gender: "",
  department: "",
  year: "TE",
});

function TeamRegistration() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchTeam = useServerFn(getMyTeam);
  const create = useServerFn(createTeam);

  const teamQuery = useQuery({ queryKey: ["my-team"], queryFn: () => fetchTeam() });

  const [form, setForm] = useState({ name: "", campus: "", department: "" });
  const [members, setMembers] = useState<MemberForm[]>(Array.from({ length: TEAM_SIZE }, emptyMember));
  const [error, setError] = useState<string | null>(null);

  const setMember = (i: number, k: keyof MemberForm, v: string) =>
    setMembers((m) => m.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof createTeam>[0]) => create(payload),
    onSuccess: async (res: { code: string }) => {
      setError(null);
      toast.success(`Team registered — ${res.code}`);
      await queryClient.invalidateQueries({ queryKey: ["my-team"] });
      void navigate({ to: "/my-team" });
    },
    onError: (e: Error) => {
      setError(e.message);
      toast.error(e.message);
    },
  });

  function submit() {
    if (members.some((m) => !m.gender)) {
      setError("Select the gender for every member — a team must include at least one female member.");
      return;
    }
    mutation.mutate({
      data: {
        name: form.name,
        campus: form.campus || undefined,
        department: form.department || undefined,
        members: members.map((m) => ({ ...m, gender: m.gender as "female" | "male" | "other" })),
      },
    } as Parameters<typeof createTeam>[0]);
  }

  if (teamQuery.data?.team) {
    const team = teamQuery.data.team;
    return (
      <div className="space-y-6">
        <PageHeader title="Team already registered" description="Your team membership is locked." icon={Lock} />
        <div className="surface-card mx-auto max-w-lg p-8 text-center">
          <h2 className="font-display text-xl font-bold">{team.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Team code {team.code}</p>
          <Button className="mt-6" onClick={() => void navigate({ to: "/my-team" })}>
            Go to my team
          </Button>
        </div>
      </div>
    );
  }

  const femaleCount = members.filter((m) => m.gender === "female").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team registration"
        description="Exactly six students including the leader, with at least one female member. Membership locks once submitted."
        icon={UserPlus}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="surface-card p-6">
            <h2 className="font-display text-base font-semibold">Team details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Team name">
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Team Innovexa"
                />
              </Field>
              <Field label="Campus">
                <Input
                  value={form.campus}
                  onChange={(e) => setForm((f) => ({ ...f, campus: e.target.value }))}
                  placeholder="Your campus"
                />
              </Field>
              <Field label="Primary department">
                <Select value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          <section className="surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold">Team members</h2>
                <p className="text-xs text-muted-foreground">
                  Member 1 is you, the team leader. All six rows are mandatory.
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                {femaleCount} female member{femaleCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {members.map((m, i) => (
                <div key={i} className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Member {i + 1} {i === 0 ? "(Leader — you)" : ""}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                      placeholder="Full name"
                      value={m.member_name}
                      onChange={(e) => setMember(i, "member_name", e.target.value)}
                    />
                    <Input placeholder="PRN" value={m.prn} onChange={(e) => setMember(i, "prn", e.target.value)} />
                    <Input placeholder="Email" value={m.email} onChange={(e) => setMember(i, "email", e.target.value)} />
                    <Input
                      placeholder="10-digit mobile"
                      value={m.mobile}
                      onChange={(e) => setMember(i, "mobile", e.target.value)}
                    />
                    <Select value={m.gender} onValueChange={(v) => setMember(i, "gender", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={m.department} onValueChange={(v) => setMember(i, "department", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={m.year} onValueChange={(v) => setMember(i, "year", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {["FE", "SE", "TE", "BE"].map((y) => (
                          <SelectItem key={y} value={y}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-5">
            <h2 className="font-display text-sm font-semibold">Before you submit</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>• Exactly six members, including you as the leader.</li>
              <li>• At least one female member is mandatory.</li>
              <li>• PRN, email and mobile must be unique for every member.</li>
              <li>• Membership is locked once the team is registered.</li>
            </ul>
            {error ? <p className="mt-3 text-xs font-medium text-destructive">{error}</p> : null}
            <Button className="mt-5 w-full" onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending ? "Registering team…" : "Submit registration & lock team"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}
