# SETUP — mettre trends° en service, pas à pas

Tout ce qui demande un compte, une clé ou un paiement est fait par l'humain. Les valeurs vont dans `.env.local` (local) et dans Coolify (production), jamais dans le dépôt.

## 0. Local

```
pnpm install
cp .env.example .env.local
pnpm dev            # http://localhost:3000/styleguide
```

Sans aucune clé : le site affiche la page d'attente (ou les états vides si `PUBLIC_SITE=true`), `/styleguide` montre tous les composants.

## 1. Supabase auto-hébergé dans Coolify

1. Sur le VPS, créer dans Coolify un nouveau **Service Supabase** dédié, projet `trends`. Ne pas partager de conteneur, volume, base ni secret avec upTake.
2. Configurer Kong sur `supabase.trends.uptake.me`. Studio peut être sur `studio-trends.uptake.me` derrière un mot de passe, ou ne pas être exposé.
3. Conserver dans le gestionnaire de mots de passe les clés `anon`, `service_role`, le secret JWT et le mot de passe Postgres générés par Coolify. Ne jamais les commiter.
4. Définir `SUPABASE_URL` comme l’URL publique HTTPS de Kong, utilisée pour les images du bucket. Définir `SUPABASE_INTERNAL_URL` comme l’adresse interne Kong de Coolify lorsque disponible. Renseigner les clés dans `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`.
5. Ne pas exposer Postgres (5432). Activer « Connect to Predefined Network » sur le service Supabase et définir dans l’application `DATABASE_URL` vers `supabase-db-<uuid>:5432` : les migrations sont appliquées au démarrage du conteneur (docs/deploy.md § 3). La migration crée les tables, active RLS et crée le bucket public `trend-images`. Avec un tunnel SSH ouvert, `pnpm db:types` peut régénérer les types TypeScript depuis cette même base.
6. Dans les réglages Auth de cette instance, configurer `https://trends.uptake.me` comme Site URL et `/auth/callback` en URL de redirection. Vérifier le fournisseur Email pour les liens magiques et définir `ADMIN_EMAILS`.
7. Détails de mise en service : `docs/deploy.md`.

## 2. Google Trends sur BigQuery

1. console.cloud.google.com → créer (ou choisir) un projet → `GOOGLE_CLOUD_PROJECT`. Activer l'API BigQuery. La facturation doit être active même pour le palier gratuit (1 To de requêtes par mois).
2. IAM → Service accounts → créer `trends-bigquery`, rôle **BigQuery Job User** (et **BigQuery Data Viewer** si demandé).
3. Keys → Add key → JSON. Mettre le contenu sur une ligne (ou en base64) dans `GOOGLE_SERVICE_ACCOUNT_JSON`.
4. Vérifier le schéma réel : `pnpm bq:schema`. Si une colonne manque, la collecte Google échoue avec un message clair : adapter `src/lib/sources/google.ts` et `docs/heat.md`.
5. Lire la fiche du jeu de données (Marketplace « Google Trends ») et ses conditions ; les noter dans `docs/sources.md`.

## 3. Wikipédia

`WIKIMEDIA_CONTACT` : un moyen de contact (email ou page de contact) mis dans le User-Agent, exigé par la politique de Wikimedia.

## 4. Anthropic (clé propre à trends°)

1. platform.claude.com → nouvelle clé dans un workspace dédié `trends` (séparé d'upTake) → `ANTHROPIC_API_KEY`.
2. Vérifier que la recherche web est autorisée pour l'organisation (Console → Settings → Privacy/Web search).
3. `AI_DAILY_BUDGET_USD=2` (plafond quotidien appliqué par le code), et une limite de dépense mensuelle dans la Console en plus.
4. Modèle par défaut : `claude-opus-5-5` (`AI_MODEL` pour changer).

## 5. Pexels

1. pexels.com/api → créer une clé → `PEXELS_API_KEY`.
2. Lire les conditions de l'API et la licence, les noter dans `docs/sources.md` (crédit, limites 200 requêtes/heure et 20 000/mois par défaut).

## 6. Premier lancement en local

```
pnpm run:daily
```

Affiche les sources lues, les candidats, l'analyse, les tendances publiées (chaleur, rang, photo) et le coût. Puis `pnpm dev` avec `PUBLIC_SITE=true` dans `.env.local` pour voir `/` et `/t/{slug}`.

## 7. Clé interne pour upTake

`/admin` → API keys → plan **Internal**, label `upTake production` → copier la clé affichée une seule fois → `TRENDS_API_KEY` côté upTake (`docs/uptake-integration.md`).

## 8. DNS

Chez le registrar de `uptake.me` : enregistrement `A` (ou `CNAME`) `trends` → IP du VPS. Si Cloudflare est devant : proxy activé, SSL « Full (strict) ». L'en-tête `cf-ipcountry` sert à choisir le pays par défaut sur l'accueil (jamais stocké).

## 9. Coolify et cron

Suivre `docs/deploy.md` : application Docker Image `ghcr.io/<owner>/uptake-trends:latest`, variables d'environnement, domaine, webhook de déploiement, lignes cron (06:30 Europe/Paris et toutes les heures), `CRON_SECRET` (`openssl rand -hex 32`).

## 10. Facultatif

- Alertes par email : `RESEND_API_KEY` + `ALERT_FROM` (fournisseur à confirmer, voir `TODO.md`).
- IndexNow : `INDEXNOW_KEY` (32 caractères hexadécimaux), actif seulement quand `PUBLIC_SITE=true`.
- PostHog (sans cookie) : `NEXT_PUBLIC_POSTHOG_KEY` (variable GitHub, figée au build).
- Script de mesure d'upTake : `NEXT_PUBLIC_UPTAKE_SCRIPT_SRC`.
