import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CycleStatus } from "./cycle.server";

export type { CycleStatus, CyclePhase } from "./cycle.server";

/** Current Internal SIH cycle state — readable by everyone, including signed-out visitors. */
export const getCycleStatus = createServerFn({ method: "GET" }).handler(async (): Promise<CycleStatus> => {
  const { describeCycle } = await import("./cycle.server");
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await client
    .from("sih_cycles")
    .select("*")
    .order("edition_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  return describeCycle((data as never) ?? null);
});

const cycleSchema = z.object({
  editionYear: z.number().int().min(2024).max(2100),
  editionLabel: z.string().trim().max(80).optional(),
  officialStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format."),
  officialEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format."),
  sourceUrl: z.string().trim().url("Enter the official source link.").max(300),
});

/** Admin/faculty confirm official dates taken from the official SIH calendar. */
export const saveCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cycleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r) => String(r.role));
    if (!roles.some((r) => r === "admin" || r === "faculty")) throw new Error("Forbidden: admin or faculty only.");
    if (data.officialEnd <= data.officialStart) throw new Error("The end date must be after the start date.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sih_cycles").upsert(
      {
        edition_year: data.editionYear,
        edition_label: data.editionLabel?.trim() || `Smart India Hackathon ${data.editionYear}`,
        official_start: data.officialStart,
        official_end: data.officialEnd,
        source_url: data.sourceUrl,
        verified: true,
        verified_at: new Date().toISOString(),
        verified_by: context.userId,
        check_status: "verified",
        check_note: "Dates confirmed from the official source by an authorised user.",
      },
      { onConflict: "edition_year" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Staff view of the calendar sync state, including any automated warning. */
export const getCycleAdminView = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRows } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r) => String(r.role));
    if (!roles.some((r) => r === "admin" || r === "faculty")) throw new Error("Forbidden: admin or faculty only.");
    const { data } = await context.supabase.from("sih_cycles").select("*").order("edition_year", { ascending: false });
    return { cycles: data ?? [] };
  });
