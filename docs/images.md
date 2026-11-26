# Photos des tendances — Pexels + filtre thermique

Chaque tendance publiée a une vraie photo, choisie automatiquement sur Pexels à partir de mots-clés visuels, copiée dans notre stockage et affichée avec un filtre « caméra thermique ». Volontairement simple : **pas de génération d'image par IA, pas d'autre banque d'images.**

## 1. Mots-clés visuels (`image_query`)

- Produits par l'analyse quotidienne (§ 6 de CLAUDE.md) : anglais, 2 à 5 mots, une scène concrète qu'on peut photographier.
- Scène bien éclairée : une photo sombre (nuit, salle éteinte) sort presque noire du filtre.
- Décrire une scène générique qui évoque le sujet, **jamais le sujet lui-même** quand c'est une marque, un produit, une œuvre ou une personne :
  - « GTA VI » → `gaming night controller neon`
  - « Black Friday » → `shopping bags city street`
  - « AI agents » → `laptop code bright office`
  - « Ski season » → `skier snowy mountain`
- Contrôle (`checkImageQuery`, testé) : 2 à 5 mots, aucun mot du `topic`, aucun mot de `src/lib/blocklist.ts`, aucun nom propre. Échec → requête par défaut de la catégorie (`CATEGORY_IMAGE_QUERY` dans `src/lib/images/queries.ts`).

## 2. Recherche et copie

- `PEXELS_API_KEY` dans `.env.example`, vide. Ne jamais inventer de clé.
- `src/lib/images/pexels.ts` : `GET https://api.pexels.com/v1/search?query=…&orientation=landscape&per_page=15&size=large`, en-tête `Authorization: <clé>`, délai 10 s. Une erreur, un 429 ou l'absence de clé ne font jamais échouer le pipeline : tendance publiée sans photo.
- Choix (`pickPhoto`, fonction pure testée) : écarter une photo utilisée dans les 30 derniers jours (`pexels_id`) et une photo trop sombre (`avg_color` de luminosité < 0,12, `MIN_BRIGHTNESS`), préférer le paysage d'au moins 1600 px, prendre la première qui reste. Rien → seconde recherche avec la requête de la catégorie → sinon pas de photo.
- Copie : télécharger `src.large2x` dans Supabase Storage (bucket public `trend-images`, nom `{slug}-{pexels_id}.jpg`). Le site et l'API ne servent jamais l'adresse de Pexels.
- Table `trend_images` : `trend_id`, `pexels_id`, `storage_path`, `width`, `height`, `avg_color`, `alt` (le `alt` de Pexels, sinon `image_query`), `photographer`, `photographer_url`, `pexels_url`, `query`, `active`, `created_at` ; une image active par tendance.
- Volume : une recherche par **nouvelle** tendance, pendant l'analyse quotidienne (10 à 20 requêtes par jour). Jamais pendant une visite ni une requête d'API.
- Admin : « Next photo » (photo suivante des résultats gardés, sinon nouvelle recherche) et « Remove photo ».
- `docs/sources.md` : Pexels avec la date de lecture, le lien vers les conditions et ce qui est permis (usage commercial, crédit, limites). Vérifier sur la page officielle avant d'écrire.

## 3. Crédit

- Sous chaque photo en grand : « Photo: {photographer} on Pexels », nom lié à `photographer_url`, « Pexels » lié à `pexels_url`. Vignettes : crédit dans le `title` et sur la page de la tendance.
- Pied de page : « Photos provided by Pexels » avec lien.
- API `v1` : `image: { url, width, height, alt, avg_color, credit: { name, url }, source_url } | null`. Un client qui affiche l'image affiche le crédit.

## 4. Filtre thermique

Composant `ThermalImage` (`src/components/ThermalImage.tsx`) : `next/image` (`alt` obligatoire, dimensions connues) passé dans un filtre SVG en trois étapes : niveaux de gris → **courbe de tonalité de la photo** → palette. Palettes, courbe et tables dans `src/lib/images/thermal.ts` (pur, testé), partagé avec les images Open Graph.

**Courbe de tonalité** (`toneCurve`) : sans elle, la couleur dépend de la luminosité brute, et la médiane des photos va de 4 % à 67 % (mesuré sur les photos du 26/11) : une photo sombre sortait toute bleu nuit, une claire toute jaune. On égalise donc partiellement l'histogramme de chaque photo (70 % égalisation, 30 % photo d'origine, `TONE_STRENGTH`) : 11 valeurs de 0 à 1, calculées avec `sharp` à la copie (`toneOf`, vignette de 128 px) et gardées dans `trend_images.tone`. Les photos sans courbe (copiées avant, calcul en échec) sont rattrapées par le rafraîchissement horaire (`backfillTones`, 20 par passage). Le composant écrit pour chaque photo deux filtres (`#th-n-<clé>`, `#th-d-<clé>`, clé = empreinte de la courbe) et les passe en variables CSS (`--th-night`, `--th-day`) ; sans courbe, il retombe sur les filtres communs `#thermal` et `#thermal-day`. La courbe ne sort jamais dans l'API (`toPublicTrend` la retire).

Filtres communs, définis une seule fois dans le layout (sans courbe de tonalité) :

```html
<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <filter id="thermal" color-interpolation-filters="sRGB">
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer>
      <feFuncR type="table" tableValues="0.043 0.141 0.482 0.894 1 1"/>
      <feFuncG type="table" tableValues="0.039 0.341 0.235 0.208 0.478 0.847"/>
      <feFuncB type="table" tableValues="0.071 1 1 0.549 0.102 0.302"/>
    </feComponentTransfer>
  </filter>
</svg>
```

Correspondance : noir → `heat-0` → `heat-1` → `heat-2` → `heat-3` → `heat-4` (zones claires = zones chaudes).

Thème `day` : palette day (`DAY_PALETTE`, filtre `#thermal-day` ou `--th-day`) : mêmes couleurs dans le même ordre, éclaircies, et les ombres partent d'un indigo moyen (`#5a4fc4`) au lieu du noir : `#5a4fc4` → `#6f8fff` → `#ad8cff` → `#f58fbe` → `#ffb27a` → `#fff0b8`. La photo est affichée pleinement, sans opacité (l'ancienne photo night estompée à 45 % sortait grise et terne, parfois presque invisible). Voiles clairs, texte, stickers et boutons « on photo » à l'encre, crédit sur pastille claire. Les images Open Graph et la carte partageable restent en palette night, avec la même courbe de tonalité (calculée à la volée par `sharp`).

- Prop `variant: "thermal" | "natural" | "cooled"` (`thermal` par défaut ; `natural` pour l'aperçu admin ; `cooled` = niveaux de gris atténués pour les tendances passées).
- Pendant le chargement : fond `avg_color` passé dans le même dégradé, sans saut de mise en page.
- Sans photo : dégradé chaud jaune → orange → violet (`heat-4` → `heat-1`), le même pour toutes les catégories. Jamais d'image cassée.
- Le texte posé sur une photo l'est toujours sur un voile (sombre en `night`, clair en `day`, classe `tr-on-photo`) : contraste 4,5:1.
- Utilisé : héros de l'accueil et de `/t/{slug}`, cartes story (60 % du haut), vignettes des classements, panneau pays, `AngleCard`, tendances liées, images Open Graph (filtre appliqué au rendu côté serveur avec `sharp`).

## 5. Tests

`checkImageQuery`, `pickPhoto` (déjà utilisées, trop sombres, format, liste vide), client Pexels avec HTTP simulé (200, 429, délai, sans clé), champ `image` de l'API (présent ou `null`, sans `tone`), `toneCurve` / `isTone` / `thermalLut` / palettes (`thermal.test.ts`).
