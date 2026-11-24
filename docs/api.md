# API — trends°

Tout ce que le serveur de trends° expose en HTTP :

1. **L'API publique `v1`** : les tendances, pour upTake et les autres clients (§ 1 à 7).
2. **Les routes du site** : formulaires, santé, IndexNow (§ 8).
3. **L'administration** : actions de `/admin` et routes d'exploitation protégées par secret (§ 9).

Règles de fond : `CLAUDE.md` § 7 (contrat), § 9 (sécurité). Intégration côté upTake : `docs/uptake-integration.md`. Comportements décrits ici vérifiés sur `https://trends.uptake.me` le 2026-11-23.

---

## 1. Vue d'ensemble de `v1`

| | |
| --- | --- |
| Adresse | `https://trends.uptake.me/api/v1` |
| Méthodes | `GET` (et `OPTIONS` pour le pré-vol CORS, réponse `204`) |
| Format | JSON, UTF-8 |
| CORS | ouvert en lecture : `Access-Control-Allow-Origin: *`, en-têtes `Authorization` et `Content-Type` autorisés |
| Cache | 10 minutes. Sans clé : `public, max-age=600, s-maxage=600`. Avec clé : `private, max-age=600`. Erreurs : `no-store`. `Vary: Authorization` |
| Données | Recalculées par la tâche quotidienne (06:30 Europe/Paris) et le rafraîchissement horaire. Aucun appel IA par requête |

**Jamais dans une réponse** : les listes brutes des sources (`signals`), les volumes ou rangs bruts de Google, Bluesky ou Hacker News, le texte des pages trouvées. Une tendance masquée dans l'admin (« Hide ») disparaît immédiatement de toutes les réponses.

## 2. Authentification et offres

Clé passée dans l'en-tête :

```
Authorization: Bearer tk_…
```

- Une clé commence par `tk_` (suivi de 32 octets aléatoires en base64url). Elle n'est montrée qu'une fois, à sa création ; la base ne garde que son empreinte SHA-256 et ses 8 premiers caractères (`prefix`).
- Sans en-tête : offre « No key ». En-tête mal formé, clé inconnue ou révoquée : `401 invalid_key` (jamais de repli silencieux sur l'offre sans clé).

Les droits viennent d'un seul fichier, `src/lib/plans.ts` :

| | Sans clé | Free | Starter | Pro | Internal (upTake) |
| --- | --- | --- | --- | --- | --- |
| Requêtes | 30 / jour / IP | 1 000 / mois | 20 000 / mois | 100 000 / mois | sans limite |
| `GET /trends` | la tendance du jour seule | les 10 du jour | jusqu'à 50 | jusqu'à 50 | jusqu'à 50 |
| Angles par tendance | 0 | 1 | tous | tous | tous |
| Filtre `country` | non | oui (un pays par requête) | oui | oui | oui |
| Filtre `category` | non | non | oui | oui | oui |
| `GET /countries` | non | non | oui | oui | oui |
| Historique (`day`, `history`) | aucun | 7 jours | 90 jours | 365 jours | 90 jours |
| `powered_by` | oui | oui | non | non | non |

Disponibilité selon la phase (`CLAUDE.md` § 3) :

- **Clés gratuites en libre-service** : seulement si `PUBLIC_API_KEYS=true` (sinon `/api/access` inscrit sur la liste d'attente, § 8).
- **Starter et Pro** : attribuables dans l'admin seulement si `PAID_PLANS=true`. Avant, l'admin ne peut créer que des clés Free ou Internal.

## 3. Limites de débit

- **Sans clé** : compteur en mémoire par IP et par jour UTC. L'IP n'est jamais stockée : la clé du compteur est une empreinte salée (`RATE_LIMIT_SALT`), remise à zéro à minuit UTC.
- **Avec clé** : compteur mensuel en base (`increment_api_usage`), remis à zéro le 1er du mois UTC. `last_used_at` est mis à jour à chaque appel.
- **Un compteur en panne ne bloque jamais une requête** : elle passe, sans `X-RateLimit-Remaining` fiable.

En-têtes de chaque réponse réussie (sauf offre Internal, sans limite) :

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
```

Dépassement : `429 rate_limited` avec `Retry-After` (secondes jusqu'à minuit UTC sans clé, jusqu'au mois suivant avec clé).

## 4. Points d'accès

Les valeurs des exemples de cette section sont illustratives ; celui du § 5 est une vraie réponse.

### `GET /api/v1/trends`

Les tendances d'un jour, triées par chaleur.

| Paramètre | Format | Défaut | Règle |
| --- | --- | --- | --- |
| `day` | `YYYY-MM-DD` | dernier jour publié | Dans l'historique de l'offre ; un jour futur → `404` |
| `country` | code ISO 3166-1 alpha-2 (`FR`, `us`…) | monde | Clé requise |
| `category` | une des catégories du § 5 | toutes | Starter, Pro, Internal |

```json
{
  "day": "2026-11-23",
  "country": null,
  "category": null,
  "count": 1,
  "trends": [ { "…": "objet tendance, § 5" } ],
  "powered_by": { "name": "upTake", "url": "https://uptake.me/?ut=trends" }
}
```

Sans clé, `trends` ne contient que la tendance du jour (`is_top: true`).

### `GET /api/v1/trends/top`

La tendance du jour : la plus chaude parmi celles sûres pour une marque (ou celle choisie par « Make top » dans l'admin).

| Paramètre | Règle |
| --- | --- |
| `country` | Clé requise ; rend la tendance la plus chaude dans ce pays |

```json
{ "day": "2026-11-23", "country": null, "trend": { "…": "objet tendance, ou null" }, "powered_by": { "…": "…" } }
```

`trend` vaut `null` si aucune tendance n'est publiée (premier jour, base vide).

### `GET /api/v1/trends/{slug}`

Une tendance, avec son historique de chaleur. `slug` : `[a-z0-9-]`, 80 caractères au plus.

```json
{
  "trend": {
    "…": "objet tendance, § 5",
    "history": [ { "day": "2026-11-22", "heat": 61, "rank": 3 }, { "day": "2026-11-23", "heat": 74, "rank": 1 } ]
  },
  "powered_by": { "…": "…" }
}
```

- `history` est coupé à l'historique de l'offre.
- Sans clé, seule la tendance du jour est accessible : toute autre → `403 trend_not_included`.
- Tendance inconnue, masquée ou retirée → `404 not_found`. Pour upTake : la retirer des moments proposés.

### `GET /api/v1/countries`

Les pays suivis, avec la tendance la plus chaude de chacun (Starter, Pro, Internal).

```json
{
  "day": "2026-11-23",
  "count": 50,
  "countries": [
    { "code": "FR", "name": "France", "heat": 82, "heat_level": "hot", "trend": { "slug": "gta-vi", "title": "gta vi", "heat": 82 } },
    { "code": "JP", "name": "Japan", "heat": null, "heat_level": null, "trend": null }
  ]
}
```

## 5. L'objet tendance

Champs de l'analyse (`CLAUDE.md` § 6, sauf `image_query` jamais servi) et champs calculés (`docs/heat.md`). Exemple réel, sans clé (donc sans angle) :

```json
{
  "topic": "The Hunger Games: Sunrise on the Reaping box office",
  "slug": "the-hunger-games-sunrise-on-the-reaping-box-office",
  "title": "sunrise on the reaping",
  "category": "entertainment",
  "why": "The sixth Hunger Games film opened to $120 million in North America, above expectations, and the franchise is heating back up.",
  "lifespan": "2+ weeks",
  "brand_safe": true,
  "risk": null,
  "audiences": [ { "label": "young adult readers", "share": 40 }, { "label": "moviegoers", "share": 35 }, { "label": "fandom creators", "share": 25 } ],
  "angles": [],
  "sources": [ { "url": "https://www.hollywoodreporter.com/…", "title": "'Hunger Games: Sunrise on the Reaping' Slays $120M at Box Office…" } ],
  "heat": 25,
  "heat_level": "cold",
  "heat_change": 0,
  "rank": 2,
  "forecast": [25, 23, 22, 20, 19],
  "countries": [],
  "first_seen": "2026-11-23",
  "last_seen": "2026-11-23",
  "expires_at": "2026-11-24T08:00:00+00:00",
  "is_top": true,
  "image": {
    "url": "https://supabase.trends.uptake.me/storage/v1/object/public/trend-images/…-7991148.jpg",
    "width": 1880, "height": 1253,
    "alt": "A person sits in a theater watching a movie on a large screen, enveloped in a dark ambiance.",
    "avg_color": "#3B393A",
    "credit": { "name": "Tima Miroshnichenko", "url": "https://www.pexels.com/@tima-miroshnichenko" },
    "source_url": "https://www.pexels.com/photo/a-person-watching-a-movie-in-a-cinema-7991148/"
  },
  "day": "2026-11-23",
  "powered_by": { "name": "upTake", "url": "https://uptake.me/?ut=trends" }
}
```

| Champ | Type | Sens |
| --- | --- | --- |
| `topic` | string | Nom du sujet, casse d'origine (« GTA VI ») |
| `slug` | string | Identifiant stable ; page : `https://trends.uptake.me/t/{slug}` |
| `title` | string | Titre affiché, minuscules, 28 caractères au plus |
| `category` | enum | `gaming`, `tech`, `ai`, `entertainment`, `sport`, `culture`, `business`, `design`, `lifestyle`, `food`, `music`, `other` |
| `why` | string | Une phrase « why it's heating up », 200 caractères au plus |
| `lifespan` | enum | `1-2 days`, `3-7 days`, `2+ weeks` |
| `brand_safe` | boolean | `false` = « handle with care » : afficher `risk` |
| `risk` | string \| null | Pourquoi la prudence, en une phrase |
| `audiences` | `{ label, share }[]` | 2 à 4 audiences, parts **estimées** (total 100) : afficher « estimated » |
| `angles` | `{ tag, title, example, fits }[]` | 2 ou 3 angles de post (coupés selon l'offre) ; `fits` = réseaux conseillés |
| `sources` | `{ title, url }[]` | Sources de l'analyse, **à afficher** avec elle (conditions d'Anthropic) |
| `heat` | 0–100 | Chaleur du jour, en degrés |
| `heat_level` | enum | `cold` < 40 ≤ `mild` < 60 ≤ `warm` < 75 ≤ `hot` < 90 ≤ `scorching` |
| `heat_change` | entier | Variation depuis la veille, en degrés |
| `rank` | entier | Rang du jour, monde |
| `forecast` | 5 entiers | Aujourd'hui puis les 4 jours suivants |
| `countries` | `{ code, heat, rank }[]` | Pays où la tendance chauffe, rang dans chaque pays |
| `first_seen`, `last_seen` | `YYYY-MM-DD` | Première et dernière présence |
| `expires_at` | ISO 8601 | Après cet instant, la tendance a refroidi : ne plus la proposer. 09:00 heure de Paris le jour où la prévision passe sous 40 ; peut changer dans la journée (rafraîchissement horaire) |
| `is_top` | boolean | Tendance du jour |
| `image` | objet \| null | Photo Pexels **non filtrée** (`docs/images.md`). Crédit obligatoire : « Photo: {credit.name} on Pexels » |
| `day` | `YYYY-MM-DD` | Jour de la mesure (champ ajouté, compatible) |
| `powered_by` | objet | Offres Sans clé et Free seulement ; présent dans l'enveloppe et dans chaque tendance |

Les pays, la chaleur, la prévision et le rang sont **calculés**, jamais fournis par l'IA. « Data source: Google Trends » doit accompagner toute donnée pays affichée.

## 6. Erreurs

Toujours la même forme, jamais le message brut d'un service :

```json
{ "error": { "code": "history_not_included", "message": "History needs an API key" } }
```

| Statut | `code` | Quand |
| --- | --- | --- |
| 400 | `invalid_day` | `day` n'est pas `YYYY-MM-DD` |
| 400 | `invalid_country` | `country` n'est pas un code à 2 lettres |
| 400 | `invalid_category` | Catégorie inconnue |
| 401 | `invalid_key` | En-tête mal formé, clé inconnue ou révoquée |
| 403 | `history_not_included` | `day` ou tendance hors de l'historique de l'offre |
| 403 | `country_not_included` | Filtre pays sans clé |
| 403 | `filter_not_included` | Filtre catégorie hors offre |
| 403 | `trend_not_included` | `/trends/{slug}` sans clé, hors tendance du jour |
| 403 | `countries_not_included` | `/countries` hors offre |
| 404 | `not_found` | Tendance inconnue ou masquée ; `day` dans le futur |
| 429 | `rate_limited` | Limite atteinte, voir `Retry-After` |
| 500 | `internal_error` | Erreur imprévue (détail dans les journaux du serveur seulement) |
| 503 | `unavailable` | Base injoignable |

Un client doit traiter `5xx` et les délais en gardant sa dernière réponse connue et en réessayant plus tard.

## 7. Compatibilité

- `v1` peut **gagner** des champs, jamais en perdre ni en changer le sens (`day` a été ajouté ainsi).
- Un changement cassant passe en `v2` ; `v1` reste servie tant qu'upTake l'utilise.
- Un client doit ignorer les champs qu'il ne connaît pas.

### Exemples

```bash
# Sans clé : la tendance du jour
curl https://trends.uptake.me/api/v1/trends/top

# Avec clé : les tendances du jour en France
curl -H "Authorization: Bearer $TRENDS_API_KEY" "https://trends.uptake.me/api/v1/trends?country=FR"

# Une tendance et son historique
curl -H "Authorization: Bearer $TRENDS_API_KEY" https://trends.uptake.me/api/v1/trends/gta-vi
```

## 8. Routes du site (hors `v1`)

Pas de contrat de compatibilité : elles servent les pages de trends°. `robots.txt` interdit `/api/` aux moteurs.

| Route | Rôle | Protection |
| --- | --- | --- |
| `POST /api/access` | « Get API access » (page `/api`). Corps `{ "email": "…", "consent": true }`. Si `PUBLIC_API_KEYS=false` : inscription à la liste d'attente → `{ ok: true, waitlist: true }`. Sinon : clé Free créée et rendue une fois → `{ ok: true, key: "tk_…" }` ; une seule clé Free active par email (`409 exists`) | 3 demandes / jour / IP (mémoire) |
| `POST /api/report` | « Report this trend ». Corps `{ "slug": "…", "reason": "sensitive" \| "wrong" \| "offensive" \| "other", "message": "…" }` ; `slug` accepte aussi un lien `/t/…` ou un nom. Anonyme, visible dans `/admin` | 10 / jour / IP (mémoire) |
| `GET /api/health` | `{ ok, db, forecast }` : `db` = base joignable en moins de 2 s ; `forecast` = `"today"` si l'analyse du jour a réussi, `"missing"` sinon. Sert au contrôle de santé Coolify (ne rend jamais le conteneur « unhealthy » pour une analyse manquée) | aucune, sans détail de connexion |
| `GET /{INDEXNOW_KEY}.txt` | Fichier de clé IndexNow, réécrit vers `/api/indexnow-key` (`next.config.ts`). `404` pour toute autre clé ou sans `INDEXNOW_KEY` | aucune |
| `GET /t/{slug}/card` | Carte story PNG de la tendance (« Share the card ») | aucune |

## 9. Administration

### 9.1 Pas d'API REST d'administration

Il n'existe **aucun point d'accès HTTP public** pour administrer trends°. L'administration passe par la page `/admin`, dont les boutons appellent des **Server Actions** Next.js (`src/app/admin/actions.ts`). Ces actions ne sont pas des URL stables et ne doivent pas être appelées depuis un script : chacune vérifie d'abord la session (`requireAdmin`).

**Connexion** :

1. `/admin/login` : saisie de l'email. Un lien magique n'est envoyé qu'aux adresses de `ADMIN_EMAILS` ; l'écran répond pareil dans tous les cas. 5 demandes par heure et 20 par jour par IP ; la raison d'un non-envoi va dans les journaux, sans l'adresse.
2. L'email mène à `https://trends.uptake.me/admin/verify/{token}`. Le jeton n'est vérifié qu'au clic sur le bouton (un antivirus qui ouvre le lien ne le consomme pas).
3. Session Supabase Auth (cookie) ; toute action sans session valide d'une adresse autorisée renvoie vers `/admin/login`.

**Actions** :

| Bouton | Action | Effet | Garde-fous |
| --- | --- | --- | --- |
| Hide / Unhide | `hideTrend` | Masque la tendance partout, API comprise, immédiatement (invalide le cache `trends`) | — |
| Make top | `makeTop` | Devient la tendance du jour (`manual_top`) | Refusé si la tendance n'est pas `brand_safe` |
| Next photo | `nextPhoto` | Photo Pexels suivante pour la tendance | 60 / jour |
| Remove photo | `removePhoto` | Retire la photo (la tendance reste publiée) | — |
| Run now | `runNow` | Lance le pipeline quotidien en arrière-plan, tracé `manual` dans `cron_runs` | 4 / jour ; le plafond `AI_DAILY_BUDGET_USD` s'applique |
| Resolve | `resolveReport` | Marque un signalement comme traité | — |
| Create key | `createKey` | Crée une clé `free` ou `internal` (plus `starter`, `pro` si `PAID_PLANS=true`), avec libellé et email facultatifs. La clé en clair est affichée **une seule fois**, via un fragment d'URL (`#new-key=…`) jamais envoyé au serveur ni journalisé | — |
| Revoke | `revokeKey` | Désactive une clé : `401 invalid_key` dès l'appel suivant | — |
| Sign out | `signOut` | Ferme la session | — |

La page montre aussi la dernière analyse (sources lues ou en échec, recherches, coût), les tendances du jour, les signalements, les clés (préfixe, offre, usage du mois, dernier appel) et la liste d'attente.

**Clé upTake** : créer une clé **Internal** nommée « upTake production » et la donner à upTake (`TRENDS_API_KEY`, `docs/uptake-integration.md`). En cas de fuite : Revoke, puis nouvelle clé.

### 9.2 Routes d'exploitation (tâches planifiées)

Seules routes « machine » qui modifient des données. Elles exigent le secret partagé :

```
Authorization: Bearer $CRON_SECRET
```

`CRON_SECRET` fait au moins 16 caractères (`openssl rand -hex 32`), comparé à temps constant. Sans secret valide (ou si `CRON_SECRET` n'est pas défini) : `401 { "error": "unauthorized" }`.

| Route | Rôle | Réponse |
| --- | --- | --- |
| `POST /api/cron/tick` | **Superviseur** : appelé toutes les 5 min par le serveur lui-même (`src/instrumentation.ts`). Lance ce qui est dû (quotidienne à 06:30, horaire, nouveaux essais à +15 min, +1 h, +3 h), une seule fois grâce au bail en base. Peut être appelé de l'extérieur sans risque | `202 { ok: true, started: true }`, travail en arrière-plan |
| `POST /api/cron/daily` | Force la tâche quotidienne (collecte, analyse IA, chaleur, photos, IndexNow) | `202 { ok: true, started: true }`, travail en arrière-plan |
| `POST /api/cron/hourly` | Rafraîchissement léger sans IA (chaleur, ticker) | `200 { ok: true, … }` (rapport) ou `500` |

Chaque exécution est tracée dans `cron_runs` et visible dans `/admin` ; le cache `trends` est invalidé à la fin. Aucun cron externe n'est nécessaire.

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://trends.uptake.me/api/cron/tick
```

## 10. Où est le code

| Sujet | Fichier |
| --- | --- |
| Droits par offre | `src/lib/plans.ts` (seul fichier qui connaît les noms d'offres) |
| Clé, limites, CORS, cache, erreurs | `src/lib/api/handler.ts`, `keys.ts`, `ratelimit.ts` |
| Règles d'accès (`day`, `country`, `category`) | `src/lib/api/access.ts` |
| Corps des réponses | `src/lib/api/endpoints.ts`, `src/lib/trends/view.ts` (`toPublicTrend`) |
| Points d'accès `v1` | `src/app/api/v1/` |
| Tests du contrat | `src/lib/api/api.test.ts` |
| Actions d'administration | `src/app/admin/actions.ts`, garde `src/lib/supabase/auth.ts` |
| Tâches planifiées | `src/app/api/cron/`, `src/lib/pipeline/` |
| Documentation publique (anglais) | page `/api` (`src/app/(site)/api/page.tsx`) |
