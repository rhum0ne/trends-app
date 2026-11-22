// `pnpm run:daily` : lance le pipeline une fois en local, avec les vraies sources
// (IA et Pexels si les clés sont dans .env.local). Affiche un résumé lisible.

import { runDaily } from "../src/lib/pipeline/daily";
import { hasDb } from "../src/lib/supabase/server";

async function main() {
  if (!hasDb()) {
    console.error("SUPABASE_URL (or SUPABASE_INTERNAL_URL) and SUPABASE_SERVICE_ROLE_KEY are required (see SETUP.md).");
    process.exit(1);
  }
  const t0 = Date.now();
  const report = await runDaily({ log: (m) => console.log(m), force: process.argv.includes("--force") });
  console.log("\n── Summary ─────────────────────────────");
  console.log(`Day: ${report.day} · status: ${report.status} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(`Candidates: ${report.candidates} · searches: ${report.searches} · cost: $${report.costUsd.toFixed(4)}`);
  for (const p of report.published) {
    console.log(`  #${p.rank} ${p.is_top ? "★ " : ""}${p.title} — ${p.heat}° — photo: ${p.photo}`);
  }
  if (report.rejected.length) {
    console.log("Rejected:");
    for (const r of report.rejected) console.log(`  - ${r.topic}: ${r.reason}`);
  }
  if (report.error) console.log(`Error: ${report.error}`);
  process.exit(report.status === "ok" ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
