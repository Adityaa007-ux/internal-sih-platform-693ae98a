import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily unattended job: verifies the official Smart India Hackathon calendar and
 * resets cycle-specific data once the one-month closure period has passed.
 */
export const Route = createFileRoute("/api/public/hooks/cycle-sync")({
  server: {
    handlers: {
      POST: async () => {
        const { runCycleMaintenance } = await import("@/lib/cycle-maintenance.server");
        try {
          const report = await runCycleMaintenance();
          return new Response(JSON.stringify({ ok: true, ...report }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
