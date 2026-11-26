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
- [x] Accueil : héros à la hauteur de l'écran (ticker + en-tête + héros visibles sans défiler, vérifié 375×812, 800×600, 1280×720, 1440×900), voiles clairs en thème day, défilement magnétique centré sur les sections (`tr-snap`). Pas encore vu sur `/t/{slug}` et `/c/{code}` avec de vraies données en day (base locale arrêtée)
- [x] Photos thermiques homogènes : courbe de tonalité par photo (`trend_images.tone`, calculée à la copie, rattrapée chaque heure) et palette day dédiée sans opacité (`docs/images.md` § 4) ; vérifié sur les 9 photos de production, night et day
- [x] Icône « t° » générée par `pnpm build:icon` (glyphe Archivo wdth 62 / wght 800 → `<path>`, anneau `heat-4`) : `icon.svg`, `favicon.ico`, `apple-icon.png`, icônes PWA, `og-avatar.png`, `manifest.ts`, section du `/styleguide`

## Étape 9 — Administration
- [x] `/admin` (lien magique, `ADMIN_EMAILS`) : analyse, Hide, Make top, Next photo, Remove photo, Run now, signalements, clés, liste d'attente
- [x] Écran admin revu : vue `AdminDashboard` séparée de la lecture en base, aperçu avec données d'exemple sur `/styleguide/admin` ; page de connexion en carte centrée ; raison d'un lien magique non envoyé dans les journaux du serveur
- [ ] `.tr-wrap`, `.tr-status-dot` (et les autres classes `tr-*` hors `@layer`) l'emportent sur les utilitaires Tailwind (`max-w-*`, `bg-*`) : les passer dans `@layer components` quand on retouchera `globals.css`

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
- [x] Analyse incrémentale (sujets nouveaux et tendances à rafraîchir seulement), `AI_EFFORT`, 8 recherches au total relances comprises
- [x] Photo du héros invisible : `.tr-photo { position: relative }` hors calque écrasait `absolute` (0 px de haut) → position par défaut dans `@layer components`. Photos trop sombres écartées (`avg_color`, `MIN_BRIGHTNESS`) ; sans photo, dégradé jaune → orange → violet
- [x] Checkup SEO/GEO (23/11) : robots d'IA en rendu bloquant (`htmlLimitedBots`, `src/lib/seo/bots.ts` : métadonnées dans le `<head>`, contenu sans streaming) ; clé IndexNow à la racine `/{clé}.txt` (en sous-dossier, IndexNow refusait les URL `/t/…`) ; JSON-LD `Organization` + `WebSite` (toutes les pages), `Article` + `BreadcrumbList` (`/t/{slug}`), `ItemList` (accueil, archive) ; canonical de l'accueil. Vérifié en local (GPTBot/ClaudeBot : `<title>` dans le `<head>`, réécriture de la clé) ; JSON-LD d'une vraie tendance non vu en local (base locale en erreur), couvert par les tests
- [x] Page tendance ouverte tout en bas après un clic depuis l'accueil défilé : Next garde l'accueil caché dans le DOM (Cache Components), `html:has(.tr-snap)` restait vrai et le pied de page devenait le seul point d'accroche → `<ScrollSnap />` pose `html[data-snap]` tant que l'accueil est affiché. Cause vérifiée en production (règle neutralisée → page en haut) ; le correctif lui-même n'est pas vu en local (base locale en erreur)
- [x] `docs/api.md` : API `v1` (offres, limites, points d'accès, objet tendance, erreurs), routes du site, administration (Server Actions, pas d'API REST) et routes d'exploitation `CRON_SECRET` ; codes d'erreur vérifiés sur l'API en ligne le 23/11
- [ ] SEO, suite du checkup : soft 404 (`/t/inconnu` et `/c/zz` répondent 200 + `noindex`, `notFound()` sous `<Suspense>`) ; `http → https` en 302 (Traefik) ; repli du ticker « Today's forecast is being prepared. » lu en premier sans JS ; titres sans mot-clé (accueil, `title` au lieu de `topic`) ; `<h1>` « archive » / « by country » ; page publique « How heat works » ; `llms.txt` ; archives mensuelles pour les tendances de plus de 30 jours
- [x] Tendances « cooled » chaque nuit (GTA VI à 30°, 24/11) : `expires_at` tombait à minuit UTC, avant l'analyse de 06:30 → 09:00 heure de Paris (`EXPIRE_AT_PARIS_MINUTES`, heure de l'alerte `daily_missing`). Le rafraîchissement horaire recalcule maintenant aussi la prévision, `expires_at` et le pic (`refreshOutlook`) ; avant, la prévision gardait la chaleur du matin. Testé ; pas vu en production
- [ ] Sans Google, la chaleur plafonne à 40° (étendue et force viennent seulement de Google) : brancher BigQuery (CHECKLIST) ; envisager de reprendre les derniers signaux Google enregistrés quand la lecture du jour échoue
- [ ] Sujets écartés comme sensibles : encore réanalysés chaque jour s'ils restent dans les signaux (coût en recherches). Mémoriser les refus récents si `ai_usage` montre que ça pèse

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
