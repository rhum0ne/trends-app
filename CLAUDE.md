# CLAUDE.md — trends° by upTake

Ce fichier dit à un agent IA ce qu'est trends°, ce qu'il doit faire et ce qu'il ne doit jamais faire. À lire en entier avant toute modification. Il donne les **règles** ; le détail est dans `docs/` :

| Fichier | Contenu |
| --- | --- |
| `docs/business-plan.md` | Pourquoi le projet existe, phases, critères de passage, coûts |
| `docs/design.md` | Direction artistique trends°, jetons, composants, règles visuelles |
| `docs/pages.md` | Fonctionnement de chaque page publique (accueil, tendance, pays, archive, API) |
| `docs/heat.md` | Calcul de la chaleur (degrés), de la prévision et du classement par pays |
| `docs/images.md` | Photos des tendances (Pexels), filtre thermique, crédits |
| `docs/sources.md` | Conditions d'utilisation de chaque source, lues et datées |
| `docs/design/tokens.json`, `docs/design/bundle.css` | Jetons et styles de référence des composants |

Les numéros de section peuvent être cités dans le code (`CLAUDE.md § 6`) : ne pas les renuméroter. Les demandes explicites de l'humain priment.

## 1. Le produit en une page

**trends° dit chaque jour aux makers de quoi tout le monde parle, et comment en parler pour leur produit sans être ridicule.** C'est « la météo d'internet » : chaque tendance a une température en degrés, une prévision, des pays où elle chauffe.

- **Le problème** : quand un sujet explose (la sortie de GTA VI, un événement sportif, une nouvelle IA), ceux qui le reprennent vite et avec justesse gagnent en visibilité. Un maker seul n'a ni le temps de surveiller, ni le recul pour savoir quoi reprendre.
- **La promesse** : « The trend of the day, and how to use it for your product. » Pour chaque tendance : pourquoi elle monte, combien de temps elle devrait durer, où elle chauffe, si une marque peut l'utiliser sans risque, à qui elle parle, 2 ou 3 angles de post.
- **Ce que l'on vend** (un jour) : une **analyse**, jamais des données brutes. Les listes des sources restent internes.
- **Ce que ce n'est pas** : un fil d'actualité, un outil de veille des réseaux sociaux, un service qui récupère des pages sans accord (aucun scraping).
- **Le ton** : météo, bref, honnête. On ne pousse jamais à surfer sur un drame.
- **Langue de l'interface et de l'API** : anglais. Commentaires et docs internes en français ou en anglais.

## 2. Place par rapport à upTake

trends° est un **projet séparé** d'upTake (copilote marketing pour makers, `uptake.me`), du même auteur.

| | trends° | upTake |
| --- | --- | --- |
| Dépôt | `uptake-trends` (celui-ci) | `uptake` |
| Adresse | `https://trends.uptake.me` | `https://uptake.me` |
| Base de données | La sienne, rien de partagé | La sienne |
| Rôle | Collecter, analyser, publier les tendances, servir l'API | Proposer à chaque projet les tendances qui lui conviennent (moments « Trend »), écrire les posts |

- **upTake est un client de l'API** (`TRENDS_API_URL`, `TRENDS_API_KEY` côté upTake), avec une clé interne sans limite. Il ne lit jamais la base de trends° directement. Contrat au § 7 : ne jamais le casser sans nouvelle version.
- **La correspondance tendance ↔ projet d'un maker se fait dans upTake**, jamais ici : trends° ne connaît aucun utilisateur ni aucune donnée d'upTake.
- **« Powered by upTake »** sur chaque page et dans chaque réponse gratuite de l'API, avec un lien suivi : `https://uptake.me/?ut=trends` (bouton d'écriture : `https://uptake.me/?ut=trends&utm_campaign=write`). C'est la raison d'être commerciale de trends° au départ.

## 3. Phases et drapeaux

On ne passe à la phase suivante que si les critères de `docs/business-plan.md` sont atteints (décision de l'humain, jamais de l'agent).

| Phase | Contenu | Drapeau |
| --- | --- | --- |
| 0 · Interne | Collecte, analyse, API lue par upTake seulement ; site public fermé (page d'attente) | `PUBLIC_SITE=false` |
| 1 · Site public | `trends.uptake.me` ouvert, pages indexables selon `docs/pages.md` | `PUBLIC_SITE=true` |
| 2 · API gratuite avec clé | Clés gratuites, limites du § 7 | `PUBLIC_API_KEYS=true` |
| 3 · Offres payantes | Starter et Pro, paiement par Paddle | `PAID_PLANS=true` |

- Un drapeau à `false` cache entièrement la fonction (pas de bouton grisé, pas de « coming soon »).
- Les prix ne sont jamais écrits dans le code pour facturer : ils vivent chez Paddle. Le code ne connaît que les droits par offre (`src/lib/plans.ts`).

## 4. Décisions techniques (arrêtées)

| Sujet | Décision |
| --- | --- |
| Framework | Next.js (dernière version stable), App Router, TypeScript strict |
| Paquets | pnpm |
| Hébergement | VPS, Coolify (Docker), image construite par GitHub Actions à chaque push sur `main` ; même VPS qu'upTake, application séparée |
| Base et stockage | Supabase auto-hébergé sur le VPS via Coolify (Postgres, Auth, Storage), instance dédiée à trends°, migrations dans `supabase/migrations/` |
| IA | API Claude via `@anthropic-ai/sdk`, **avec sa propre clé** (`ANTHROPIC_API_KEY`), séparée de celle d'upTake |
| Tâches planifiées | Routes `/api/cron/*` appelées par un planificateur externe (cron du VPS) avec `CRON_SECRET` ; chaque exécution est tracée en base (`cron_runs`) |
| UI | Tailwind, composants maison repris de `docs/design/bundle.css`, icônes `lucide-react`, **une seule police : Archivo** (`next/font/google`), § 10 |
| Graphiques | SVG écrit à la main. Pas de bibliothèque de graphiques |
| Images | Photos Pexels copiées dans Supabase Storage, filtre thermique en SVG (`docs/images.md`) |
| Tests | Vitest pour toute la logique (`src/lib`) |
| Analytics | PostHog sans cookie ni enregistrement de session, identifiants anonymes |

Aucune dépendance à supabase.com : tout passe par `SUPABASE_URL` / clés de l'instance auto-hébergée.

## 5. Le pipeline quotidien

Une tâche `daily` par jour à 06:30 Europe/Paris, plus un rafraîchissement léger `hourly` (chaleur et ticker) et un bouton « Run now » dans l'administration. Détail des calculs : `docs/heat.md`.

1. **Collecte des signaux gratuits** (`src/lib/sources/`, un fichier par source, délai 10 s chacune, une source en panne n'arrête pas les autres) :
   - Google Trends : jeu de données public BigQuery (`international_top_terms` et `international_top_rising_terms`, une cinquantaine de pays, quotidien ; `top_terms` / `top_rising_terms` pour les États-Unis) ;
   - Wikipédia : API Pageviews officielle (articles les plus vus de la veille, plusieurs langues), avec un `User-Agent` qui contient un moyen de contact ;
   - Bluesky : `app.bsky.unspecced.getTrendingTopics` (point d'accès non stabilisé : tolérer sa disparition) ;
   - Hacker News : API Algolia, première page sur 24 h.
   Chaque sujet est normalisé (`normalizeTopic` : casse, accents, chiffres romains, alias évidents) et rangé avec ses sources, son rang et son pays dans `signals` (interne).
2. **Analyse IA, une seule fois par jour pour tout le monde** : modèle fort, outil de recherche web de l'API Claude (8 recherches au plus), sortie JSON validée par `zod` (§ 6). Aucun appel IA par visiteur ni par requête d'API.
3. **Chaleur, score et sélection**, sans IA (fonctions pures testées, `docs/heat.md`) : une tendance doit être confirmée par au moins une source gratuite **et** par l'analyse ; 10 tendances au plus ; **la tendance du jour** = la plus chaude parmi celles sûres pour une marque. Chaleur par pays calculée pour chaque tendance publiée.
4. **Sécurité de marque** : liste de mots écartés en dur (`src/lib/blocklist.ts` : décès, attentat, guerre, catastrophe, élection, religion…), en plus du jugement de l'IA. Un sujet bloqué ou jugé à risque n'est **jamais** publié ni servi par l'API.
5. **Photo** : une recherche Pexels par nouvelle tendance à partir de `image_query`, copie dans le stockage (`docs/images.md`). Une tendance sans photo est publiée quand même.
6. **Expiration** : chaque tendance a un `expires_at` selon sa durée de vie ; une tendance expirée sort de « today » et reste en archive (« This trend has cooled »).
7. **Échecs** : analyse en échec → un nouvel essai, puis la journée garde les tendances de la veille encore valides. Deux échecs de suite, ou moins de deux sources qui répondent : alerte à l'administrateur (email), une seule fois par incident.

## 6. Règles pour l'IA

- **Un seul point d'appel** : `generateStructured` (`src/lib/ai/`), jamais le SDK directement. Il gère la validation `zod`, le nouvel essai, le plafond de dépense et le suivi du coût.
- **Plafond de dépense** : `AI_DAILY_BUDGET_USD` (2 $ par défaut). Au-delà, plus d'appel jusqu'au lendemain ; l'API continue de servir ce qui est déjà calculé.
- **Schéma de sortie d'une tendance** :
  ```ts
  {
    topic: string,               // "GTA VI"
    slug: string,                // "gta-vi"
    title: string,               // "gta vi" : minuscules, 28 caractères au plus (affiché en grand)
    category: "gaming" | "tech" | "ai" | "entertainment" | "sport" | "culture" | "business" | "design" | "lifestyle" | "food" | "music" | "other",
    why: string,                 // 200 caractères au plus, une phrase « why it's heating up »
    lifespan: "1-2 days" | "3-7 days" | "2+ weeks",
    brand_safe: boolean,
    risk: string | null,         // dit en une phrase pourquoi « handle with care »
    audiences: { label: string; share: number }[],  // 2 à 4, parts estimées qui font 100, marquées « estimated »
    angles: { tag: string; title: string; example: string; fits: string }[],  // 2 ou 3 ; example 200 caractères au plus
    image_query: string,         // anglais, 2 à 5 mots, scène générique photographiable (docs/images.md)
    sources: { title: string; url: string }[]       // 2 au moins
  }
  ```
  Les pays, la chaleur, la prévision et le rang ne viennent **jamais** de l'IA : ils sont calculés (`docs/heat.md`).
- **Contrôles après génération** : chaque adresse de source en http(s) et présente parmi les résultats de recherche réellement renvoyés ; aucun chiffre dans `why` ni `angles` qui ne vienne des données collectées ou des pages trouvées (au moindre doute, retirer le chiffre) ; longueurs respectées ; `image_query` contrôlée par `checkImageQuery`.
- **Angles de post** : ne jamais suggérer un partenariat ou une approbation par la marque citée ; ne jamais proposer d'utiliser un logo, un visuel ou une marque déposée ; pas de ton opportuniste sur un sujet grave ; un angle qui ne colle à aucun produit ne s'écrit pas.
- **Sources affichées** : toute analyse issue de la recherche web est montrée avec ses sources, conformément aux conditions d'Anthropic.

## 7. API (contrat avec upTake et les autres clients)

Versionnée : `/api/v1/…`. JSON, UTF-8, CORS ouvert en lecture, cache de 10 minutes.

| Point d'accès | Rend |
| --- | --- |
| `GET /api/v1/trends?day=YYYY-MM-DD&country=FR&category=…` | Les tendances du jour (par défaut aujourd'hui, monde entier), triées par chaleur |
| `GET /api/v1/trends/top?country=FR` | La tendance du jour (monde, ou du pays demandé) |
| `GET /api/v1/trends/{slug}` | Une tendance, avec son historique de chaleur et sa prévision |
| `GET /api/v1/countries` | Les pays suivis, avec la tendance la plus chaude de chacun |

Réponse d'une tendance : les champs du § 6 (sauf `image_query`), plus `heat` (0–100), `heat_level` (`cold`…`scorching`), `heat_change` (vs la veille), `rank`, `forecast` (5 valeurs), `countries` (`{ code, heat, rank }[]`), `first_seen`, `last_seen`, `expires_at`, `is_top`, `image` (`docs/images.md`, ou `null`), et dans l'offre gratuite `powered_by: { name: "upTake", url: "https://uptake.me/?ut=trends" }`.

**Jamais dans une réponse** : les listes brutes des sources (`signals`), les volumes ou rangs bruts de Google, Bluesky ou Hacker News, le texte des pages trouvées.

**Accès et limites** (table `api_keys`, clés gardées en empreinte SHA-256, jamais en clair) :

| | Sans clé | Clé gratuite | Starter | Pro | Interne (upTake) |
| --- | --- | --- | --- | --- | --- |
| Requêtes | 30 / jour / IP | 1 000 / mois | 20 000 / mois | 100 000 / mois | sans limite |
| Contenu | tendance du jour | les 10 du jour, 1 angle | tout | tout | tout |
| Pays | monde | monde + 1 pays par requête | tous | tous | tous |
| Historique | aucun | 7 jours | 90 jours | 12 mois | 90 jours |
| Mention « Powered by upTake » | oui | oui | non | non | non |

- Clé passée par `Authorization: Bearer tk_…`. Dépassement : `429` avec `Retry-After`. Un compteur en panne ne bloque jamais une requête.
- Les droits par offre ne sont lus qu'à un seul endroit (`src/lib/plans.ts`). Aucun autre fichier ne compare un nom d'offre.
- **Compatibilité** : on peut ajouter un champ, jamais en retirer ni en changer le sens dans `v1`. Un changement cassant = `v2`, et `v1` reste servie tant qu'upTake l'utilise.

## 8. Site public

Fonctionnement détaillé : `docs/pages.md`. L'essentiel :

- `/` : ticker LIVE, la tendance du jour en grand (photo thermique, degrés, prévision), « also heating up » (cartes story avec Shuffle), « by country » (tuiles par pays avec drapeau, top 3 du pays choisi), le classement de la semaine, l'encart API.
- `/t/{slug}` : une tendance en détail (chaleur sur 7 jours + prévision, où elle chauffe, audiences, angles, sécurité de marque, signaux, tendances liées). `noindex` tant que la tendance n'a pas été présente au moins 2 jours.
- `/c/{code}` : un pays (top du jour et de la semaine). `/archive` : les 30 derniers jours. `/api` : documentation et « Get API access ».
- Chaque angle de post a « Copy » et « Write it in upTake » (lien suivi du § 2). Bouton « Report this trend ».
- Sitemap avec la vraie date de la dernière analyse, jamais la date du build. IndexNow pour les pages nouvelles ou modifiées. Pas de données structurées trompeuses, pas de texte caché.
- Liens sortants vers les sources : `rel="noopener"`, jamais `nofollow`.

## 9. Sécurité, droits et interdits

- **Aucun scraping** de réseau social ou de site sans API ou flux officiel ; aucune source (Pexels compris) ajoutée sans avoir lu ses conditions et noté le résultat dans `docs/sources.md` (date, lien, ce qui est permis).
- **Attribution** : « Data source: Google Trends » avec lien partout où une donnée Google est montrée ; crédit Pexels et photographe sous chaque photo (`docs/images.md`) ; liens vers les sources sur chaque tendance.
- **Jamais** de logo, capture, visuel officiel ou personnage d'une marque, d'un jeu, d'un film : ni dans les photos, ni dans les angles. Les drapeaux sont dessinés (composant `Flag`, pas d'emoji).
- **Aucune donnée personnelle** : pas de compte visiteur, pas de cookie de suivi, IP jamais stockée (clé de limite de débit en mémoire seulement). Le seul email stocké est celui laissé volontairement pour une clé d'API ou la liste d'attente.
- **Secrets** : dans les variables d'environnement, jamais dans le code ni dans le dépôt. Ne jamais inventer une clé ou une valeur : `.env.example` + l'humain les remplit.
- **Administration** (`/admin`) : accès réservé aux adresses de `ADMIN_EMAILS`, connexion par lien magique. On y voit la dernière analyse (sources lues ou en échec, recherches, coût), les tendances du jour avec « Hide » (masquage immédiat partout, API comprise), « Make top », « Next photo », « Remove photo », « Run now », les signalements, les clés et leur usage.
- **Limites de débit** sur tout ce qui coûte ou envoie quelque chose (analyse, email, création de clé, recherche Pexels).
- Messages d'erreur : jamais le message brut d'un service ni une trace d'exception à l'écran.

## 10. Design

Direction artistique complète : `docs/design.md`. Les règles qui ne se discutent pas :

- **La météo d'internet vue par une caméra thermique**, fond nuit (`night`) par défaut, thème `day` disponible.
- **L'échelle thermique** `heat-0` (bleu) → `heat-4` (jaune) ne sert qu'à la chaleur, plus le seul bouton principal de chaque écran.
- **Une seule police : Archivo.** Largeur condensée (`font-stretch: 62%`, 800, minuscules) pour les grands titres et le logo `trends°` uniquement ; largeur normale pour tout le reste, chiffres compris (`font-variant-numeric: tabular-nums`). Aucune police à chasse fixe, sauf dans les exemples de code de `/api`.
- **De vraies photos**, passées dans le filtre thermique : jamais d'illustration codée à la main, jamais de forme abstraite à la place d'une image.
- Carte story 9:16, stickers inclinés, ticker LIVE, classement façon hit-parade, prévision sur 5 jours, tuiles pays colorées par leur chaleur avec drapeau.
- Vocabulaire météo (heat, heating up, cooling, heatwave, forecast). Jamais « viral », jamais d'emoji.
- Tout chiffre d'exemple porte « Example ». Mouvement réduit avec `prefers-reduced-motion`. Contraste 4,5:1 au moins.

## 11. Commandes

```
pnpm install
pnpm dev          # http://localhost:3000
pnpm test
pnpm lint
pnpm typecheck
pnpm run:daily    # lance le pipeline une fois en local (sources réelles, IA et Pexels si les clés sont là)
pnpm db:types     # régénère les types Supabase
pnpm db:migrate   # applique les migrations en attente (DATABASE_URL) ; en production, fait au démarrage du conteneur
```

## 12. Méthode de travail

1. Lire ce fichier, puis `docs/` et `TODO.md`.
2. Après chaque tâche : `pnpm typecheck`, `pnpm lint`, `pnpm test` doivent passer ; mettre à jour `TODO.md`. Les vérifications humaines vont dans `CHECKLIST.md`.
3. Toute nouvelle règle durable va ici, en une ou deux lignes ; le détail va dans `docs/`.
4. Ne jamais changer le contrat de l'API `v1` (§ 7) sans prévenir : upTake en dépend.
5. En cas de doute sur les droits d'une source, d'une image ou sur un sujet sensible : ne pas publier, noter la question dans `TODO.md`.
6. Tâche bloquée (clé manquante, API qui change) : faire la version minimale qui ne casse rien, la mettre derrière un drapeau, noter le blocage dans `TODO.md`, passer à la suite.
7. Next.js 16 avec Cache Components : aucune page ne lit la base au build (`await connection()` dans un composant sous `<Suspense>`) ; les lectures passent par `src/lib/trends/queries.ts` (`"use cache"`, 10 min, tag `trends`), et toute écriture visible invalide ce tag (`updateTag` dans une action, `revalidateTag` ailleurs).
8. Le schéma BigQuery est vérifié à chaque collecte (`INFORMATION_SCHEMA`) ; `pnpm bq:schema` l'affiche. Une colonne qui change = mettre à jour `src/lib/sources/google.ts` et `docs/heat.md`.
9. Migrations : un fichier `supabase/migrations/<version>_<nom>.sql` par changement, jamais modifié une fois poussé ; elles sont appliquées automatiquement au démarrage du conteneur (`scripts/migrate.mjs`, même suivi que la CLI Supabase). Une migration en échec empêche le démarrage : la tester en local d'abord.
