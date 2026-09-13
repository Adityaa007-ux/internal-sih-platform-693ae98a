import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { getCycleAdminView, saveCycle } from "@/lib/cycle.functions";

export const Route = createFileRoute("/_authenticated/admin/cycles")({
  head: () => ({ meta: [
    { title: "SIH Cycle Calendar — Internal SIH Platform" },
    { name: "description", content: "Configure verified official Smart India Hackathon dates and monitor annual cycle status." },
    { property: "og:title", content: "SIH Cycle Calendar — Internal SIH Platform" },
    { property: "og:description", content: "Verified annual Smart India Hackathon cycle configuration for authorised staff." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CyclePage,
});

function CyclePage() {
  const load = useServerFn(getCycleAdminView);
  const save = useServerFn(saveCycle);
  const qc = useQueryClient();
  const cycles = useQuery({ queryKey: ["cycle-admin"], queryFn: () => load() });
  const [form, setForm] = useState({ editionYear: new Date().getFullYear(), editionLabel: "", officialStart: "", officialEnd: "", sourceUrl: "https://www.sih.gov.in/" });
  const mutation = useMutation({ mutationFn: () => save({ data: form }), onSuccess: () => { toast.success("Verified cycle saved."); void qc.invalidateQueries({ queryKey: ["cycle-admin"] }); }, onError: (e: Error) => toast.error(e.message) });
  return <div className="space-y-6"><PageHeader title="SIH cycle calendar" description="Enter dates only after confirming them on the official Smart India Hackathon source." icon={CalendarClock} />
    <section className="surface-card p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-primary" /><p className="text-sm text-muted-foreground">The platform opens 30 days before the verified start date, retains cycle records for 30 days after the end date, then clears only cycle-specific operational records.</p></div>
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <Field label="Edition year"><input className="field" type="number" min={2024} max={2100} value={form.editionYear} onChange={(e) => setForm({ ...form, editionYear: Number(e.target.value) })} required /></Field>
        <Field label="Edition label"><input className="field" maxLength={80} value={form.editionLabel} onChange={(e) => setForm({ ...form, editionLabel: e.target.value })} placeholder="Smart India Hackathon" /></Field>
        <Field label="Official start date"><input className="field" type="date" value={form.officialStart} onChange={(e) => setForm({ ...form, officialStart: e.target.value })} required /></Field>
        <Field label="Official end date"><input className="field" type="date" value={form.officialEnd} onChange={(e) => setForm({ ...form, officialEnd: e.target.value })} required /></Field>
        <div className="md:col-span-2"><Field label="Official source URL"><input className="field" type="url" maxLength={300} value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} required /></Field></div>
        <div className="md:col-span-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save verified dates"}</Button></div>
      </form>
    </section>
    <section className="surface-card overflow-hidden"><div className="border-b border-border px-5 py-4"><h2 className="font-display font-semibold">Configured cycles</h2></div>{cycles.isLoading ? <p className="p-5 text-sm text-muted-foreground">Loading cycles…</p> : cycles.data?.cycles.length ? <div className="divide-y divide-border">{cycles.data.cycles.map((c) => <div key={c.id} className="grid gap-2 p-5 text-sm md:grid-cols-[1fr_auto]"><div><p className="font-semibold">{c.edition_label || `Smart India Hackathon ${c.edition_year}`}</p><p className="mt-1 text-muted-foreground">{c.official_start ?? "Not set"} — {c.official_end ?? "Not set"}</p><p className="mt-1 text-xs text-muted-foreground">Last check: {c.last_checked_at ? new Date(c.last_checked_at).toLocaleString("en-IN") : "Not checked"} · {c.check_note || c.check_status}</p></div><a className="inline-flex items-center gap-1 text-xs font-medium text-primary" href={c.source_url} target="_blank" rel="noreferrer">Official source <ExternalLink className="size-3" /></a></div>)}</div> : <p className="p-5 text-sm text-muted-foreground">No official cycle dates have been configured. No dates are invented automatically.</p>}</section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>; }
