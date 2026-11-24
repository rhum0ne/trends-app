# Intégration côté upTake — ce qu'upTake doit appeler

À donner à l'agent du dépôt `uptake`. trends° ne connaît aucun utilisateur d'upTake : **la correspondance tendance ↔ projet se fait dans upTake** (moments « Trend »).

## Configuration (côté upTake)

| Variable | Valeur |
| --- | --- |
| `TRENDS_API_URL` | `https://trends.uptake.me/api/v1` |
| `TRENDS_API_KEY` | clé **interne** créée dans `https://trends.uptake.me/admin` (offre « Internal ») ; commence par `tk_` |

En-tête de chaque appel : `Authorization: Bearer $TRENDS_API_KEY`. La clé interne n'a pas de limite de débit, voit tout (tous les angles, tous les pays, 90 jours d'historique) et ne reçoit pas `powered_by`.

## Points d'accès utiles

| Appel | Usage dans upTake |
| --- | --- |
| `GET /trends` | Les tendances du jour (10 au plus), triées par chaleur. À appeler une fois par jour après 07:00 Europe/Paris, puis mettre en cache. |
| `GET /trends?country=FR` | Les tendances qui chauffent dans le pays du projet. |
| `GET /trends?category=ai` | Filtrer par catégorie. |
| `GET /trends/top` | La tendance du jour (monde) ; `?country=FR` pour un pays. |
| `GET /trends/{slug}` | Le détail d'une tendance, avec `history` (chaleur par jour). |
| `GET /countries` | Les pays suivis et leur tendance la plus chaude. |

Réponses en JSON, cache HTTP de 10 minutes. Référence complète (champs, erreurs, limites) : `docs/api.md`. `v1` ne perd jamais de champ ; un changement cassant passerait en `v2`.

## Champs utiles pour un moment « Trend »

```jsonc
{
  "slug": "gta-6",                  // identifiant stable (lien : https://trends.uptake.me/t/{slug})
  "title": "gta vi",                // minuscules, 28 caractères au plus
  "category": "gaming",
  "why": "…",                       // une phrase « why it's heating up »
  "lifespan": "3-7 days",
  "brand_safe": true,               // false → afficher `risk` et prévenir l'utilisateur
  "risk": null,
  "audiences": [{ "label": "…", "share": 55 }],   // parts estimées : afficher « estimated »
  "angles": [{ "tag": "…", "title": "…", "example": "…", "fits": "X, LinkedIn" }],
  "sources": [{ "title": "…", "url": "…" }],      // à montrer avec l'analyse
  "heat": 94, "heat_level": "scorching", "heat_change": 12,
  "forecast": [94, 97, 81, 66, 54],               // aujourd'hui puis 4 jours
  "countries": [{ "code": "US", "heat": 96, "rank": 1 }],
  "expires_at": "2026-11-27T08:00:00.000Z",       // ne plus proposer après cette date
  "is_top": true,
  "image": {                                       // ou null
    "url": "https://….supabase.co/storage/v1/object/public/trend-images/gta-6-123.jpg",
    "width": 1880, "height": 1253, "alt": "…", "avg_color": "#334455",
    "credit": { "name": "Photographer", "url": "https://www.pexels.com/@…" },
    "source_url": "https://www.pexels.com/photo/…/"
  }
}
```

Règles à respecter dans upTake :

- **Ne proposer que des tendances non expirées** (`expires_at` dans le futur). `brand_safe: false` = « handle with care » : afficher `risk`.
- **Crédit photo obligatoire** quand l'image est affichée : « Photo: {credit.name} on Pexels », nom lié à `credit.url`, « Pexels » lié à `source_url`. L'image n'est pas filtrée : appliquer le filtre thermique de trends° si on veut le même rendu (`docs/images.md` § 4).
- **Sources** : afficher les liens `sources` à côté de l'analyse (conditions d'Anthropic sur la recherche web).
- Les angles ne suggèrent jamais de partenariat ni l'usage d'un logo : upTake ne doit pas en rajouter en réécrivant le post.
- Un `404` sur `/trends/{slug}` = tendance masquée ou retirée : la retirer des moments proposés.
- Un `5xx` ou un délai : garder la dernière réponse connue, réessayer plus tard. Ne jamais bloquer upTake sur trends°.
- Lien « Write it in upTake » depuis trends° : `https://uptake.me/?ut=trends&utm_campaign=write` (source `ut=trends` à reconnaître côté upTake).
