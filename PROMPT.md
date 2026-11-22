# Prompt de lancement — trends° by upTake

> À coller dans Claude Code, dans un dépôt vide `uptake-trends` qui contient déjà `CLAUDE.md` et le dossier `docs/` de ce kit.

---

Tu vas créer **trends°**, « la météo d'internet » pour makers : chaque jour, les tendances du moment, leur chaleur en degrés, les pays où elles chauffent, leur prévision, et comment en parler pour un produit. C'est un projet séparé d'upTake (`uptake.me`), publié sur `trends.uptake.me`, avec sa propre API qu'upTake consomme.

## Avant d'écrire une ligne

1. Lis **en entier** `CLAUDE.md`, puis `docs/business-plan.md`, `docs/design.md`, `docs/pages.md`, `docs/heat.md`, `docs/images.md`, `docs/sources.md`. Ces fichiers font foi ; en cas de contradiction, `CLAUDE.md` gagne, et tu me signales la contradiction.
2. Lis la doc de la version de Next.js que tu installes (`node_modules/next/dist/docs/`) avant d'écrire du code Next.
3. Vérifie le schéma réel des tables BigQuery `bigquery-public-data.google_trends` (`international_top_terms`, `international_top_rising_terms`, `top_terms`, `top_rising_terms`) et adapte `docs/heat.md` si une colonne diffère. Ne suppose rien.
4. Crée `TODO.md` avec le plan ci-dessous découpé en tâches, et `CHECKLIST.md` (ce que je dois faire ou vérifier à la main : clés, conditions des sources, relectures). Puis commence.

## Ce qui est arrêté (ne pas rediscuter)

- Next.js App Router, TypeScript strict, pnpm, Tailwind, `lucide-react`, Vitest.
- Supabase dédié (Postgres + Storage, UE), migrations dans `supabase/migrations/`.
- Claude via `@anthropic-ai/sdk` derrière `generateStructured`, plafond `AI_DAILY_BUDGET_USD`.
- Docker + GitHub Actions → Coolify sur le VPS (même VPS qu'upTake, application séparée).
- Design trends° : fond nuit, échelle thermique réservée à la chaleur, **une seule police (Archivo)**, **vraies photos Pexels en filtre thermique**, aucune illustration dessinée en code, drapeaux dessinés (jamais d'emoji).
- Rien n'est jamais inventé : clés dans `.env.example` (vides), conditions des sources lues et datées avant activation, aucun chiffre dans les textes qui ne vienne des données.

## Plan de réalisation (dans cet ordre)

Après **chaque** étape : `pnpm typecheck`, `pnpm lint`, `pnpm test` passent, `TODO.md` est à jour, et tu me résumes en 5 lignes ce qui marche et ce qui m'attend dans `CHECKLIST.md`.

### Étape 1 — Socle
- Projet Next.js, Tailwind avec les jetons de `docs/design/tokens.json` (thèmes `night` par défaut et `day`), Archivo via `next/font/google` (axes largeur et graisse), styles de `docs/design/bundle.css` repris en composants.
- `.env.example` complet (Supabase, `ANTHROPIC_API_KEY`, `AI_DAILY_BUDGET_USD`, `CRON_SECRET`, `PEXELS_API_KEY`, Google Cloud pour BigQuery, `ADMIN_EMAILS`, drapeaux `PUBLIC_SITE`, `PUBLIC_API_KEYS`, `PAID_PLANS`, PostHog facultatif).
- `Dockerfile` (sortie `standalone`), workflow GitHub Actions qui construit et pousse l'image `ghcr.io/…/uptake-trends` à chaque push sur `main`, `docs/deploy.md` pour Coolify.
- Page `/styleguide` (noindex) qui montre chaque composant avec des données d'exemple marquées « Example » : `HeatBadge`, `ThermalImage`, `TrendCard`, `TrendRow`, `Forecast`, `HeatCurve`, `Ticker`, `Sticker`, `CountryTile`, `Flag`, `AngleCard`, `Button`, `PoweredBy`, `ApiSnippet`, `CooledCard`. C'est là que je valide le rendu avant le reste.

### Étape 2 — Base de données
Migrations : `signals` (interne), `trends`, `trend_days` (chaleur, rang, prévision par jour), `trend_countries` (chaleur et rang par pays et par jour), `trend_images`, `analysis_runs` (sources lues, recherches, coût), `cron_runs`, `ai_usage`, `reports`, `api_keys`, `api_usage`, `waitlist`. RLS activée partout ; lecture publique seulement via le serveur ; tout est écrit par la clé service. Types générés.

### Étape 3 — Collecte
Un fichier par source dans `src/lib/sources/` (BigQuery Google Trends par pays, Wikipédia Pageviews, Bluesky, Hacker News), délai 10 s, une source en panne n'arrête pas les autres, `normalizeTopic` testée. Tests avec réponses simulées. `pnpm run:daily` lance la collecte en local.

### Étape 4 — Analyse IA et sécurité de marque
`generateStructured`, schéma `zod` du § 6 de `CLAUDE.md` (avec `title`, `audiences`, `angles`, `image_query`), outil de recherche web (8 au plus), contrôles après génération (sources réellement trouvées, aucun chiffre inventé, longueurs, `checkImageQuery`), `blocklist.ts`, plafond de dépense, nouvel essai puis repli sur la veille, alerte admin une seule fois par incident.

### Étape 5 — Chaleur, pays, prévision
`src/lib/heat/` selon `docs/heat.md` : chaleur 0–100, niveaux, heatwave, chaleur par pays, rangs du jour et de la semaine, prévision 5 jours, « cools in », « best window », titre de la courbe, `expires_at`, facteurs « signals ». Tout en fonctions pures, tout testé.

### Étape 6 — Photos
`docs/images.md` en entier : client Pexels, `pickPhoto`, copie dans Storage, `trend_images`, crédit, `ThermalImage` avec le filtre SVG, repli sans photo.

### Étape 7 — API v1
Les quatre points d'accès du § 7, cache 10 minutes, `powered_by` en gratuit, limites par IP et par clé (`src/lib/plans.ts` seul endroit qui connaît les offres), clé interne pour upTake, jamais de données brutes. Tests du contrat (forme de la réponse, `image` présent ou `null`, limites, 429).

### Étape 8 — Site public
Pages de `docs/pages.md` : `/`, `/t/{slug}`, `/c`, `/c/{code}`, `/archive`, `/api`, plus le pied de page commun, le thème night/day, Shuffle, la sélection d'un pays, la carte story partageable (`next/og`), les images Open Graph, le sitemap (vraie date de l'analyse), IndexNow, `noindex` selon les règles. Tant que `PUBLIC_SITE=false`, le site public affiche seulement une page d'attente (« The internet's weather report, coming soon. Powered by upTake ») et l'API sert upTake.

### Étape 9 — Administration
`/admin` (lien magique, `ADMIN_EMAILS`) : dernière analyse (sources, recherches, coût), tendances du jour avec Hide, Make top, Next photo, Remove photo, aperçu `natural` de la photo, Run now, signalements, clés et usage, liste d'attente.

### Étape 10 — Tâches planifiées et mise en service
Routes `/api/cron/daily` (06:30 Europe/Paris) et `/api/cron/hourly` protégées par `CRON_SECRET`, tracées dans `cron_runs`, plus la ligne cron du VPS dans `docs/deploy.md`. `SETUP.md` pas à pas : créer le projet Supabase, le compte de service BigQuery, la clé Pexels, la clé Anthropic, le DNS `trends.uptake.me`, Coolify, le cron.

## Côté upTake (ne pas le faire ici)

Écris seulement `docs/uptake-integration.md` : ce qu'upTake doit appeler (`TRENDS_API_URL`, `TRENDS_API_KEY`, `/api/v1/trends`, champs utiles, crédit photo à afficher). Je le donnerai à l'agent d'upTake.

## Définition de « terminé » pour ce premier jet

- `pnpm run:daily` en local, avec mes clés, produit au moins 5 tendances analysées, sûres, avec chaleur, pays, prévision et photo.
- `/styleguide` montre tous les composants dans les deux thèmes, sur téléphone et sur ordinateur.
- `/` et `/t/{slug}` affichent les vraies données du jour, comme décrit dans `docs/pages.md`.
- L'API `v1` répond avec le contrat du § 7 et ses limites.
- L'image Docker se construit et la procédure de `docs/deploy.md` est complète.
- `CHECKLIST.md` liste tout ce que je dois faire à la main ; `docs/sources.md` liste ce qu'il me reste à lire.
