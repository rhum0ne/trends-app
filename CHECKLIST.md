# CHECKLIST — à faire ou vérifier à la main

Ce que l'agent ne peut pas faire (comptes, clés, lectures de conditions, décisions). Détail pas à pas : `SETUP.md`.

## Clés et comptes
- [ ] Service Supabase auto-hébergé dédié à trends° dans Coolify ; domaines Kong `supabase.trends.uptake.me` et Studio protégé ou non exposé
- [ ] Enregistrer dans le gestionnaire de mots de passe les clés anon/service_role, JWT secret et mot de passe Postgres ; ne rien réutiliser d’upTake
- [ ] `SUPABASE_URL`, `SUPABASE_INTERNAL_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` définis dans Coolify ; service role côté serveur seulement
- [ ] `DATABASE_URL` interne définie dans l’application ; journaux du déploiement : `[migrate] applied …` ; RLS et bucket `trend-images` vérifiés
- [ ] Supabase Auth : Site URL + Redirect URL `/auth/callback` ; `ADMIN_EMAILS`
- [ ] Google Cloud : projet, API BigQuery, compte de service « BigQuery Job User » ; `GOOGLE_CLOUD_PROJECT`, `GOOGLE_SERVICE_ACCOUNT_JSON`
- [ ] **`pnpm bq:schema`** : confirmer le schéma réel des 4 tables Google Trends (non vérifié par l'agent, voir `docs/heat.md` § Précisions)
- [ ] `WIKIMEDIA_CONTACT` (contact pour le User-Agent)
- [ ] Clé Anthropic dédiée à trends° (`ANTHROPIC_API_KEY`), recherche web autorisée dans la Console, limite mensuelle dans la Console en plus de `AI_DAILY_BUDGET_USD`
- [ ] Clé Pexels (`PEXELS_API_KEY`)
- [ ] `CRON_SECRET` (`openssl rand -hex 32`)
- [ ] `INDEXNOW_KEY` dans Coolify (`openssl rand -hex 16`) ; après déploiement, `https://trends.uptake.me/{clé}.txt` renvoie la clé
- [ ] Facultatif : `RESEND_API_KEY` + `ALERT_FROM` (alertes), `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_UPTAKE_SCRIPT_SRC`

## Conditions des sources (`docs/sources.md`) — à lire et dater avant la production
- [ ] Google Trends sur BigQuery (fiche Marketplace, attribution, usage commercial)
- [ ] Wikimedia : API Pageviews et politique User-Agent
- [ ] Bluesky : consignes développeurs, `getTrendingTopics`
- [ ] Hacker News / Algolia
- [ ] Claude : outil de recherche web (affichage des sources)
- [ ] Pexels : conditions de l'API et licence (crédit, limites)
- [ ] Archivo : licence de la police (OFL, à confirmer)
- [x] `flag-icons` : MIT, lu le 2026-11-22

## Décisions à prendre
- [ ] `noindex` d'une tendance avant 2 jours (`docs/pages.md`) : une tendance « 1-2 days » risque de n'être indexée qu'une fois refroidie. Garder ou indexer dès le premier jour ?
- [ ] Robots d'entraînement d'IA (GPTBot, CCBot, Google-Extended…) : autorisés aujourd'hui comme les autres. L'analyse étant le produit, n'autoriser que les robots de recherche (OAI-SearchBot, Claude-SearchBot, PerplexityBot) ?
- [ ] Fournisseur d'email pour les alertes (Resend codé par défaut, ou autre)
- [ ] Liste de mots bloqués (`src/lib/blocklist.ts`) : volontairement large (« dead », « army », « temple », « crash »…), à ajuster après les premières relectures
- [ ] Modèle de l'analyse : `claude-opus-5-5` par défaut ; surveiller le coût réel dans `/admin` (budget 2 $/jour)
- [ ] Interprétation retenue (à valider) : `sensitive: true` (jugé grave par l'IA) = jamais publié ; `brand_safe: false` = publié avec « Caution » et `risk`
- [ ] Sans clé, l'API sert la tendance du jour **sans angle** (business plan) : à confirmer

## Déploiement (`docs/deploy.md`)
- [ ] Secrets GitHub `NEXT_PUBLIC_*`, `COOLIFY_WEBHOOK_URL`, `COOLIFY_TOKEN`
- [ ] Applications dédiées trends° dans Coolify (Supabase + image GHCR, port 3000, health `/api/health`, domaine, variables)
- [ ] DNS `trends`, `supabase.trends` et éventuellement `studio-trends` → VPS (Cloudflare : SSL Full strict)
- [ ] Postgres non exposé ; ports publics limités à 80/443 et SSH
- [ ] Journaux de l'application : `[scheduler] started` au démarrage ; `/api/health` → `forecast: "today"` après 06:30
- [ ] Sauvegarde Postgres quotidienne, 14 jours, vers S3 externe ; volume Storage sauvegardé
- [ ] Restauration de sauvegarde testée le : __________ ; volume Storage vérifié le : __________
- [ ] Vérification mensuelle : image Supabase Coolify mise à jour après sauvegarde récente
- [ ] Mémoire VPS vérifiée avec upTake actif ; services Supabase optionnels désactivés (noter lesquels) : __________
- [ ] Vérification finale `/api/health` (`db: true`), photo Storage, exécution daily dans `cron_runs`, upTake intact
- [ ] Clé interne « upTake production » créée dans `/admin`, donnée à upTake avec `docs/uptake-integration.md`

## Référencement (après déploiement)
- [ ] Rich Results Test / validateur schema.org sur `/` et une page `/t/{slug}` : `Article`, `BreadcrumbList`, `ItemList` sans erreur
- [ ] `curl -A GPTBot https://trends.uptake.me/t/{slug}` : `<title>`, canonical et JSON-LD présents, `<title>` avant `</head>`
- [ ] Google Search Console et Bing Webmaster Tools : site vérifié, sitemap envoyé

## Vérifications après le premier lancement réel (`pnpm run:daily` avec les clés)
- [ ] Au moins 5 tendances analysées, sûres, avec chaleur, pays, prévision et photo
- [ ] Relire chaque tendance : aucun sujet sensible, angles sans partenariat ni logo, chiffres vérifiables, sources ouvertes une par une
- [ ] Photos : aucune ne montre un logo, un produit ou une personne connue ; crédit visible
- [ ] Coût de l'analyse dans `/admin` (sous 2 $)
- [ ] `/` et `/t/{slug}` avec `PUBLIC_SITE=true` en local : rendu réel, téléphone (360 px) et ordinateur, thèmes night et day
- [ ] `/styleguide` : valider le rendu de chaque composant
- [ ] `/styleguide/admin` puis `/admin` connecté : valider le nouvel écran d'administration (night, day, téléphone)
- [ ] Vérifier l'icône dans un onglet Chrome, sur l'écran d'accueil iOS et sur Android
- [ ] Carte partageable `/t/{slug}/card` et image Open Graph : police Archivo largeur normale (limite de `next/og`), à valider
- [ ] Contraste 4,5:1 sur les photos réelles (texte sur dégradé sombre)
- [ ] API : `curl` sans clé (tendance du jour, `powered_by`), avec la clé interne (tout), 31 appels sans clé → `429` avec `Retry-After`

## Relecture quotidienne (phase 0, ~10 min)
- [ ] `/admin` : sources lues, tendances rejetées et pourquoi, coût ; « Hide » si un sujet ne doit pas passer
- [ ] Signalements
