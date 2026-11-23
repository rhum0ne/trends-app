# TODO — trends° by upTake

Plan de réalisation du premier jet (PROMPT.md). Coché = fait et vérifié par `pnpm typecheck`, `pnpm lint`, `pnpm test`.
Les vérifications humaines sont dans `CHECKLIST.md`.

## Avant de commencer
- [x] Lire `CLAUDE.md` et `docs/`
- [x] Lire la doc de Next.js 16.4 (`node_modules/next/dist/docs/`) : Cache Components, `use cache`, proxy, route handlers, fonts
- [~] Schéma BigQuery `google_trends` : fiche officielle illisible hors console, pas de `gcloud` ici → script `pnpm bq:schema` (lit `INFORMATION_SCHEMA.COLUMNS`) + contrôle des colonnes à chaque collecte. Colonnes supposées notées dans `docs/heat.md`, **à confirmer** (CHECKLIST)

## Étape 1 — Socle
- [x] Next.js 16.4 App Router, TypeScript strict, pnpm, Tailwind 4 avec les jetons night/day
- [x] Archivo via `next/font/google` (axes `wdth` + graisse), une seule police
- [x] Styles de `bundle.css` repris dans `globals.css` + composants React
- [x] `.env.example` complet
- [x] `Dockerfile` (standalone), workflow GitHub Actions → `ghcr.io/<owner>/uptake-trends`, `docs/deploy.md`
- [x] `/styleguide` (noindex), deux thèmes côte à côte, données « Example »

## Étape 2 — Base de données
- [x] Migration `0001_init.sql` : toutes les tables, RLS partout, bucket `trend-images`
- [x] Client serveur (clé service) ; types écrits à la main dans `src/lib/supabase/database.types.ts` → à remplacer par `pnpm db:types` une fois le projet créé

## Étape 3 — Collecte
- [x] `normalizeTopic` + tests
- [x] Sources : BigQuery (international + US), Wikipédia, Bluesky, Hacker News ; délai 10 s ; une panne n'arrête pas les autres
- [x] Tests avec réponses simulées
- [x] `pnpm run:daily`

## Étape 4 — Analyse IA et sécurité de marque
- [x] `generateStructured` (seul point d'appel), plafond `AI_DAILY_BUDGET_USD`, suivi du coût dans `ai_usage`
- [x] Recherche web (8 au plus) puis sortie structurée validée par zod
- [x] Contrôles : sources réellement trouvées, chiffres, longueurs, `checkImageQuery`, `blocklist.ts`
- [x] Nouvel essai, repli sur la veille, alerte admin une fois par incident

## Étape 5 — Chaleur, pays, prévision
- [x] `src/lib/heat/` : chaleur, niveaux, heatwave, pays, rangs, prévision, cools in, best window, titre de courbe, `expires_at`, facteurs — tout testé

## Étape 6 — Photos
- [x] Client Pexels, `pickPhoto`, copie dans Storage, `trend_images`, crédit, filtre thermique, repli

## Étape 7 — API v1
- [x] 4 points d'accès, cache 10 min, `powered_by`, limites IP/clé (`plans.ts`), 429 + `Retry-After`, tests du contrat

## Étape 8 — Site public
- [x] `/`, `/t/{slug}`, `/c`, `/c/{code}`, `/archive`, `/api`, en-tête, pied de page, thème, Shuffle, sélection de pays
- [x] Carte story partageable (`next/og`), images Open Graph, sitemap, IndexNow, `noindex`
- [x] Page d'attente quand `PUBLIC_SITE=false`

## Étape 9 — Administration
- [x] `/admin` (lien magique, `ADMIN_EMAILS`) : analyse, Hide, Make top, Next photo, Remove photo, Run now, signalements, clés, liste d'attente

## Étape 10 — Tâches planifiées et mise en service
- [x] `/api/cron/daily`, `/api/cron/hourly`, `cron_runs`, ligne cron dans `docs/deploy.md`
- [x] `SETUP.md`, `docs/uptake-integration.md`

## Déploiement Coolify / Supabase auto-hébergé
- [x] Instance dédiée trends° documentée dans Coolify, réseau interne, tunnel SSH et variables sans dépendance à supabase.com
- [x] Image standalone non-root, `/api/health` avec contrôle DB limité à 2 s, GH Actions → GHCR → webhook Coolify
- [x] Procédure de déploiement, DNS, cron, sauvegardes, restauration, mémoire, mise à jour mensuelle et ports publics documentés
- [x] Chargement d'images autorisé depuis `supabase.trends.uptake.me` (ancien nom `api-trends` abandonné) ; panneau pays élargi sous la grille
- [ ] Configuration du VPS, secrets, sauvegardes et vérifications réelles : suivre `CHECKLIST.md`
- [x] Migrations appliquées au démarrage du conteneur (`scripts/migrate.mjs`, `DATABASE_URL` interne)
- [x] Superviseur intégré (`/api/cron/tick` toutes les 5 min) : rattrapage, nouveaux essais espacés, bail en base, incident `daily_missing` ; plus de cron externe
- [x] Écran sans prévision selon l'état réel (en cours, prévue, en retard, reportée) ; thème du système par défaut, suivi en direct

## Questions ouvertes / blocages
- Email d'alerte : aucun fournisseur n'est fixé dans `CLAUDE.md`. Implémenté avec Resend si `RESEND_API_KEY` est présent, sinon l'incident est seulement visible dans `/admin`. **Décision humaine.**
- Script de mesure d'upTake : extrait inconnu ici → variable `NEXT_PUBLIC_UPTAKE_SCRIPT_SRC`.
- Image Open Graph : `next/og` ne gère pas les polices variables ni `font-stretch` ; le titre y est en Archivo largeur normale (fichier statique chargé depuis Google Fonts au rendu).
- Premier lancement réel (`pnpm run:daily` avec les clés) non fait ici : aucune clé dans cet environnement.
- Vérifié en local avec Supabase local (`npx supabase start`) et des données d'exemple : migration OK, accueil, `/t/{slug}`, `/c/{code}`, `/archive`, `/admin/login`, API, carte PNG et OG revus à l'œil (23/11).
  - Corrigé : `.env.development.local` utilisait encore `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` alors que le code lit `SUPABASE_URL` / `SUPABASE_ANON_KEY` (`.env.example`) → aucune lecture en base. `.env.local` a encore les anciens noms (vides) : à renommer en le remplissant.
  - Corrigé : carte et OG plantaient (« No fonts are loaded ») : Google Fonts ne sert plus de TTF au User-Agent MSIE ; un échec de police n'est plus gardé en cache et la carte répond 503 au lieu d'un flux cassé.
  - Ajouté : 404 et page d'erreur aux couleurs du site (la 404 par défaut de Next passait le fond en blanc).
  - Non vérifié : photos (aucune clé Pexels ici), `/admin` connecté (lien magique), thème `day`.
- `.env.development.local` pointe vers le Supabase local : à supprimer quand le vrai projet est prêt.
