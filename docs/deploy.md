# Déploiement — Coolify sur le VPS

trends° est une application distincte d’upTake, avec son propre service Supabase auto-hébergé sur le même VPS. Aucune ressource, base, clé ou variable d’upTake ne doit être réutilisée. Le dépôt ne contient aucune valeur secrète.

## 1. Créer Supabase dans Coolify

1. Dans Coolify, créer une nouvelle ressource de type **Service Supabase**, avec le nom de projet `trends`. Cette instance est réservée à trends°.
2. Configurer le domaine Kong de l’API en `supabase.trends.uptake.me`. Exposer Studio sur `studio-trends.uptake.me` uniquement si nécessaire et le protéger par mot de passe ; sinon ne pas l’exposer.
3. Après le démarrage, relever dans le gestionnaire de mots de passe les clés `anon` et `service_role`, le secret JWT et le mot de passe Postgres générés par Coolify. Ne jamais les mettre dans le dépôt.
4. Garder Postgres sur le réseau Docker interne. Aucun port Postgres (5432) ne doit être exposé sur Internet.

## 2. Réseau et variables Supabase

- Dans Coolify, fournir à l’application l’URL interne Kong du service Supabase en `SUPABASE_INTERNAL_URL` lorsque le réseau interne est disponible. L’application utilise cette URL pour la base et l’authentification côté serveur.
- `SUPABASE_URL` est l’URL HTTPS publique `supabase.trends.uptake.me`. Elle sert à produire les URL des images du bucket `trend-images`, chargées par le navigateur.
- Les deux URL pointent vers l’instance dédiée trends°. Ne configurez aucune URL ou clé issue du projet upTake ou de supabase.com.
- Les clés `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont celles créées par cette instance. La clé service reste exclusivement côté serveur et n’a jamais de préfixe `NEXT_PUBLIC_`.
- `DATABASE_URL` est l’URL PostgreSQL interne du service (`postgresql://postgres:<mot de passe encodé>@supabase-db-<uuid>:5432/postgres`), utilisée par le conteneur pour appliquer les migrations. Elle exige « Connect to Predefined Network » sur le service Supabase. Ne publiez pas le port 5432.

## 3. Migrations automatiques

1. À chaque démarrage, le conteneur lance `node migrator/migrate.mjs` puis le serveur (`Dockerfile`). Le script applique les fichiers de `supabase/migrations/` absents de `supabase_migrations.schema_migrations` (la table de la CLI Supabase), chacun dans sa transaction, sous un verrou consultatif.
2. Sans `DATABASE_URL`, l’étape est ignorée. Si une migration échoue, le conteneur s’arrête avant le serveur : le contrôle de santé échoue et Coolify garde l’ancienne version. Le message d’erreur Postgres est dans les journaux du déploiement.
3. La migration initiale crée les tables, active RLS sur chacune et crée le bucket public `trend-images` pour la lecture des objets. Le bucket est public en lecture ; les écritures restent côté serveur.
4. En local : `pnpm db:migrate` avec `DATABASE_URL` vers la base de `supabase start`. Un tunnel SSH n’est plus nécessaire que pour `pnpm db:types` sur la base de production.
5. Tester l’authentification admin et conserver les clés/URL de cette instance dans le gestionnaire de mots de passe.

## 4. Construire et publier l’image

À chaque push sur `main`, GitHub Actions exécute `pnpm typecheck`, `pnpm lint` et `pnpm test`, puis construit et pousse `ghcr.io/<owner>/uptake-trends:latest` et `ghcr.io/<owner>/uptake-trends:<sha>` (SHA complet).

Le workflow est `.github/workflows/deploy.yml`. Configurer comme **secrets GitHub Actions** :

- `COOLIFY_WEBHOOK_URL`
- `COOLIFY_TOKEN`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_POSTHOG_KEY` (facultatif)
- `NEXT_PUBLIC_POSTHOG_HOST` (facultatif)
- `NEXT_PUBLIC_UPTAKE_SCRIPT_SRC` (facultatif)

Les variables `NEXT_PUBLIC_*` sont figées à la construction de l’image. Les autres secrets et paramètres figurant dans `.env.example` sont configurés à l’exécution dans Coolify, jamais dans l’image. Le workflow publie également un tag SHA complet.

Construire localement :

```sh
docker build -t uptake-trends .
```

Pour un test local, exécuter l’image avec un fichier d’environnement contenant des valeurs de développement dédiées :

```sh
docker run --env-file .env.local -p 3000:3000 uptake-trends
```

## 5. Créer l’application dans Coolify

1. Ajouter une ressource **Docker Image** : `ghcr.io/<owner>/uptake-trends:latest`. Si le paquet GHCR est privé, configurer dans Coolify un registre avec un jeton GitHub limité à `read:packages`.
2. Configurer le domaine `trends.uptake.me` avec HTTPS via Traefik/Let’s Encrypt et le port interne `3000`. L’image lance le serveur en utilisateur non root et vérifie `/api/health`.
3. Ajouter les variables de `.env.example` requises. Utiliser exclusivement les URL, clés et secrets propres à l’instance Supabase trends°. Garder les drapeaux de phase selon la décision humaine.
4. Activer le redémarrage automatique. Dans GitHub, renseigner le webhook Coolify et le jeton dans les secrets du workflow.
5. En production, l’application doit joindre Supabase via `SUPABASE_INTERNAL_URL` quand Coolify fournit une adresse interne utilisable.

## 6. DNS et ports

Créer des enregistrements A pour `trends`, `supabase.trends` et, si Studio est exposé, `studio-trends`, pointant vers l’adresse IP du VPS. Si Cloudflare est devant, activer le proxy et choisir SSL **Full (strict)**.

Sur le VPS, seuls 80/443 et SSH sont ouverts. Postgres (5432), les ports internes Supabase et tout port de service de l’application restent fermés depuis Internet.

## 7. Tâches planifiées

Configurer dans les tâches planifiées de Coolify ou dans le cron du VPS les appels suivants avec `CRON_SECRET` stocké dans l’environnement du planificateur :

```sh
# Tous les jours à 06:30 Europe/Paris
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://trends.uptake.me/api/cron/daily

# Chaque heure
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://trends.uptake.me/api/cron/hourly
```

Chaque exécution est enregistrée dans `cron_runs` et consultable dans `/admin`.

## 8. Sauvegardes, mises à jour et mémoire

- Configurer une sauvegarde quotidienne de Postgres dans Coolify, avec 14 jours de rétention, vers un stockage S3 externe au VPS.
- Sauvegarder aussi le volume Supabase Storage vers le stockage externe.
- Effectuer une restauration d’essai et dater le résultat dans `CHECKLIST.md`.
- Vérifier la mémoire disponible du VPS avec upTake en fonctionnement : Supabase auto-hébergé consomme plusieurs Go. Désactiver Realtime, Edge Functions ou Analytics si ces services sont optionnels dans le modèle Coolify utilisé, et noter les services désactivés dans `CHECKLIST.md`.
- Mettre à jour mensuellement l’image Supabase dans Coolify, après vérification des notes de version et avec une sauvegarde récente.

## 9. Vérification après déploiement

1. `https://trends.uptake.me/api/health` renvoie `{"ok":true,"db":true}`. En cas de base inaccessible, `db` vaut `false` sans exposer d’identifiant ni de secret.
2. Vérifier qu’une photo stockée dans le bucket `trend-images` se charge sur le site.
3. Lancer une fois `daily` manuellement et vérifier l’entrée correspondante dans `cron_runs`.
4. Vérifier que les pages et tâches d’upTake répondent normalement et qu’aucun conteneur, volume, base ou secret n’est partagé.
5. Confirmer qu’aucun port autre que 80/443 et SSH n’est ouvert sur le VPS.
