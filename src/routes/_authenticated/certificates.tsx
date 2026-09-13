import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, CheckCircle2, LockKeyhole, Printer, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { getCertificateState, issueMyCertificate, submitMentorRating, type RatingTarget } from "@/lib/certificates.functions";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({ meta: [
    { title: "Mentor Feedback & Certificate — Internal SIH Platform" },
    { name: "description", content: "Complete required mentor feedback and access your individual Internal SIH participation certificate." },
    { property: "og:title", content: "Internal SIH Participation Certificate" },
    { property: "og:description", content: "Secure mentor-feedback and participation-certificate access for Internal SIH students." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CertificatesPage,
});

function CertificatesPage() {
  const fetchState = useServerFn(getCertificateState);
  const submit = useServerFn(submitMentorRating);
  const issue = useServerFn(issueMyCertificate);
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ["certificate-state"], queryFn: () => fetchState() });
  const issueMutation = useMutation({
    mutationFn: () => issue(),
    onSuccess: () => { toast.success("Your certificate is ready."); void qc.invalidateQueries({ queryKey: ["certificate-state"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return <div className="space-y-6">
    <PageHeader title="Mentor feedback & certificate" description="Every team member must rate each required mentor before individual certificates unlock." icon={Award} />
    {state.isLoading ? <div className="surface-card p-8 text-sm text-muted-foreground">Checking eligibility…</div> : null}
    {state.error ? <div className="surface-card p-8 text-sm text-danger">{state.error.message}</div> : null}
    {state.data ? <>
      <section className="surface-card p-5">
        <div className="flex items-start gap-3">
          <span className={`flex size-10 items-center justify-center rounded-lg ${state.data.eligible ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
            {state.data.eligible ? <CheckCircle2 className="size-5" /> : <LockKeyhole className="size-5" />}
          </span>
          <div><h2 className="font-display font-semibold">{state.data.eligible ? "Certificate unlocked" : "Certificate locked"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{state.data.team ? `${state.data.team.name} · ${state.data.team.member_count}/6 members` : "No team is linked to your account."}</p></div>
        </div>
        {state.data.blockers.length ? <ul className="mt-4 space-y-2 text-sm text-muted-foreground">{state.data.blockers.map((b) => <li key={b}>• {b}</li>)}</ul> : null}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {state.data.targets.map((target) => <RatingForm key={target.kind} target={target} onSave={async (values) => {
          await submit({ data: { mentorKind: target.kind, ...values } });
          toast.success(`Feedback saved for ${target.label}.`);
          await qc.invalidateQueries({ queryKey: ["certificate-state"] });
        }} />)}
      </div>
      {state.data.certificate ? <CertificateCard certificate={state.data.certificate} /> : state.data.eligible ? <Button onClick={() => issueMutation.mutate()} disabled={issueMutation.isPending}><Award className="size-4" />{issueMutation.isPending ? "Issuing…" : "Issue my certificate"}</Button> : null}
    </> : null}
  </div>;
}

function RatingForm({ target, onSave }: { target: RatingTarget; onSave: (values: RatingValues) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [scores, setScores] = useState({ overall: 5, guidance: 5, availability: 5, technical: 5, communication: 5, helpfulness: 5 });
  const [feedback, setFeedback] = useState("");
  if (target.rated) return <div className="surface-card p-5"><CheckCircle2 className="size-5 text-success" /><h2 className="mt-3 font-display font-semibold">{target.label}</h2><p className="mt-1 text-sm text-muted-foreground">Your feedback is complete.</p></div>;
  return <form className="surface-card p-5" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSave({ ...scores, feedback }); } finally { setBusy(false); } }}>
    <div className="flex items-center gap-2"><Star className="size-4 text-warning" /><h2 className="font-display font-semibold">Rate {target.label}</h2></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.keys(scores).map((key) => <label key={key} className="text-xs font-medium capitalize text-muted-foreground">{key}<select className="field mt-1" value={scores[key as keyof typeof scores]} onChange={(e) => setScores({ ...scores, [key]: Number(e.target.value) })}>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select></label>)}</div>
    <label className="mt-3 block text-xs font-medium text-muted-foreground">Comments<textarea className="field mt-1 min-h-24" maxLength={1000} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></label>
    <Button className="mt-4" type="submit" disabled={busy}>{busy ? "Saving…" : "Submit feedback"}</Button>
  </form>;
}

type RatingValues = { overall: number; guidance: number; availability: number; technical: number; communication: number; helpfulness: number; feedback: string };

function CertificateCard({ certificate }: { certificate: NonNullable<Awaited<ReturnType<typeof getCertificateState>>["certificate"]> }) {
  return <section className="certificate-sheet border-4 border-double border-primary bg-card p-8 text-center print:border-foreground">
    <p className="text-xs font-semibold uppercase tracking-widest text-primary">Internal SIH Platform</p><h2 className="mt-4 font-display text-3xl font-bold">Certificate of Participation</h2>
    <p className="mt-6 text-sm text-muted-foreground">This certifies that</p><p className="mt-2 font-display text-2xl font-bold">{certificate.student_name}</p>
    <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">participated in the Internal Smart India Hackathon as a member of <strong className="text-foreground">{certificate.team_name}</strong>{certificate.ps_title ? `, working on “${certificate.ps_title}”.` : "."}</p>
    <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5 text-left text-xs"><div><p className="text-muted-foreground">Certificate ID</p><p className="font-mono font-semibold">{certificate.certificate_id}</p></div><div><p className="text-muted-foreground">Institution</p><p className="font-semibold">{certificate.institution}</p></div><Button variant="outline" onClick={() => window.print()}><Printer className="size-4" />Print / save PDF</Button></div>
  </section>;
}
