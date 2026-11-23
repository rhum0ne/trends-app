// Démarre le superviseur des tâches (CLAUDE.md § 5) avec le serveur : plus besoin d'un cron externe.
// Toutes les 5 minutes, le serveur appelle sa propre route /api/cron/tick (dans un vrai contexte de requête,
// pour que after() et revalidateTag fonctionnent). Le premier appel arrive 30 s après le démarrage :
// une analyse manquée pendant un arrêt ou un déploiement est rattrapée tout de suite.
//
// Actif en production seulement (ou SCHEDULER=on), jamais avec SCHEDULER=off. Il faut CRON_SECRET.

const EVERY_MS = 5 * 60_000;
const FIRST_MS = 30_000;

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const mode = (process.env.SCHEDULER ?? "").trim().toLowerCase();
  if (mode === "off") return;
  if (mode !== "on" && process.env.NODE_ENV !== "production") return;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) {
    console.warn("[scheduler] CRON_SECRET missing or too short: scheduler not started");
    return;
  }
  const url = `http://127.0.0.1:${process.env.PORT ?? "3000"}/api/cron/tick`;
  const call = async () => {
    try {
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) console.warn(`[scheduler] tick answered ${res.status}`);
    } catch (e) {
      console.warn("[scheduler] tick unreachable", e instanceof Error ? e.message : e);
    }
  };
  setTimeout(call, FIRST_MS).unref();
  setInterval(call, EVERY_MS).unref();
  console.log("[scheduler] started: tick every 5 minutes");
}
