# Design — trends°

**trends° est la météo d'internet, vue par une caméra thermique.** Chaque tendance a une température (sa chaleur, en degrés), une prévision (combien de temps avant qu'elle refroidisse), les pays où elle chauffe, et sa carte verticale qu'on fait défiler comme un fil de stories.

Fichiers de référence : `docs/design/tokens.json` (jetons, thèmes `night` et `day`) et `docs/design/bundle.css` (styles des composants, classes `tr-`). Les reprendre dans Tailwind (`@theme`) et dans des composants React ; ne pas recopier les valeurs ailleurs.

Maquettes validées par l'humain (pour lui, l'agent n'y a pas accès) : canevas claude.ai « trends° — landing & trend page ». Ce fichier et `docs/pages.md` en sont la description qui fait foi.

## Trois idées, partout

1. **La chaleur est l'unité.** Une tendance ne « buzze » pas : elle chauffe. On l'affiche en degrés (`94°`), colorée sur l'échelle thermique ; elle « refroidit » quand elle passe. Le signe ° est le glyphe de la marque.
2. **Le fil vertical.** L'unité de lecture est la carte story 9:16 avec ses barres de progression en haut. Sur téléphone on fait défiler, sur ordinateur les cartes s'alignent.
3. **La nuit d'abord.** Fond sombre (`night`) : une salle où seule la chaleur brille. Le thème `day` existe avec les mêmes règles. Par défaut, le site prend le thème du système du visiteur et le suit en direct ; le bouton du pied de page force l'autre (choix gardé dans le navigateur), et revenir au thème du système efface ce choix.

## Voix

- **Vocabulaire météo** : heat, forecast, heating up, cooling, heatwave (au-dessus de 90° plusieurs jours), « cools in ~3 days », « today's forecast ». Jamais « viral », « buzz », « insane ».
- Court, en anglais. Titres de tendance en minuscules (`gta vi`, `black friday`).
- On dit pourquoi : chaque tendance a sa phrase « why it's heating up ».
- Pas d'emoji, pas de point d'exclamation.

## Couleurs

| Jeton | Night | Day | Usage |
| --- | --- | --- | --- |
| `night` | `#0b0a12` | `#f7f5fb` | Fond de page |
| `surface` | `#15131f` | `#ffffff` | Cartes, lignes, panneaux |
| `surface-2` | `#1e1b2c` | `#efecf6` | Zones enfoncées, survol, code |
| `line` | `#2c2840` | `#ddd8ea` | Traits, bordures |
| `ink` | `#f5f3ff` | `#120f1e` | Texte principal |
| `ink-muted` | `#a39fbd` | `#5b5672` | Texte secondaire |
| `safe` | `#3ddc97` | `#0e8a5a` | Sûr pour une marque, hausse |
| `caution` | `#ffb020` | `#9a5b00` | À manier avec précaution |
| `cooled` | `#6e6a85` | `#9a96ad` | Tendance passée |
| `focus` | `#ffd84d` | `#2457ff` | Anneau de focus |

**Échelle thermique** (identique dans les deux thèmes), **réservée à la chaleur** et au seul bouton principal de chaque écran :

| Niveau | Degrés | Jeton | Couleur | Texte dessus |
| --- | --- | --- | --- | --- |
| cold | 0–39° | `heat-0` | `#2457ff` (le bleu d'upTake) | `on-cold` `#ffffff` |
| mild | 40–59° | `heat-1` | `#7b3cff` | `on-cold` |
| warm | 60–74° | `heat-2` | `#e4358c` | `on-hot` `#120f1e` |
| hot | 75–89° | `heat-3` | `#ff7a1a` | `on-hot` |
| scorching | 90°+ | `heat-4` | `#ffd84d` | `on-hot` |

- `safe` / `caution` toujours avec un mot (« Brand-safe », « Caution »), jamais la couleur seule.
- Ombres : `lift` pour les cartes, `glow-hot` réservé à **la** tendance du jour (une par écran).

## Typographie : une seule police

- **Archivo** (Google Fonts, axes largeur 62–125 et graisse 400–900), chargée par `next/font/google`.
- **Titres et logo** : Archivo condensé (`font-stretch: 62%`), 800, minuscules, interligne 0,82–0,95. Utilisé seulement pour le titre de la tendance du jour, les titres de section, les titres de cartes story, les noms dans les tuiles pays et le logo `trends°`.
- **Tout le reste**, chiffres compris : Archivo largeur normale, 400 à 800, `font-variant-numeric: tabular-nums` sur les degrés, rangs, variations et dates.
- **Aucune police à chasse fixe** dans l'interface (l'ancienne Martian Mono est retirée). Seule exception : les blocs de code de `/api`, en `ui-monospace` du système.
- Dans `bundle.css`, `--font-display`, `--font-body` et `--font-data` pointent tous vers Archivo.
- Échelle : titre de la tendance du jour `clamp(120px, 16vw, 220px)` ; titres de section 40–44 ; titre de carte story 56 ; degrés en grand 64 ; texte 15–19 ; petits textes 12–13.

## Images : de vraies photos, en thermique

- Chaque tendance a **une vraie photo** (Pexels), choisie automatiquement à partir de mots-clés visuels, copiée dans notre stockage, puis affichée avec le **filtre thermique** (gradient map noir → `heat-0` → … → `heat-4`). Détail : `docs/images.md`.
- C'est ce qui donne un sens aux couleurs : les zones claires de la photo deviennent jaunes, les zones sombres bleues, comme vues par une caméra thermique.
- **Jamais** d'illustration dessinée en code, de forme abstraite ou de dégradé seul à la place d'une photo, sauf en repli quand il n'y a pas de photo (dégradé de la catégorie, discret).
- Jamais de logo, capture ou visuel officiel d'une marque, d'un jeu ou d'un film.
- Crédit visible : « Photo: {name} on Pexels ».

## Drapeaux

- Composant `Flag` (code ISO à deux lettres) : drapeaux dessinés en SVG ou en CSS, rectangle 3:2 aux coins arrondis 4 px, liseré `rgba(255,255,255,.18)`. Tailles 26×18 et 40×28.
- Jamais d'emoji drapeau (rendu différent selon les systèmes, absent sous Windows). Une bibliothèque de drapeaux SVG libre de droits (par exemple `flag-icons`, licence MIT) est acceptable : vérifier la licence et la noter dans `docs/sources.md`.
- Toujours accompagné du code ou du nom du pays (accessibilité).

## Composants (`bundle.css`)

| Composant | Classe | Rôle |
| --- | --- | --- |
| `HeatBadge` | `tr-heat l0…l4`, `xl`, `cooled` | Le degré, coloré par niveau |
| `ThermalImage` | (nouveau, `docs/images.md`) | La photo filtrée derrière une tendance |
| `TrendCard` | `tr-story` (+ `top`) | Carte story 9:16 : photo en haut (60 %), barres, pays, stickers, titre, why, degré, « cools in » |
| `TrendRow` | `tr-row` | Ligne du classement : rang, ▲ / ▼ / NEW, vignette photo, nom, courbe 7 jours, degré |
| `Forecast` | `tr-forecast`, `tr-day` | 5 barres colorées par niveau, « best window to post » |
| `HeatCurve` | (nouveau) | Courbe 7 jours mesurés + 4 jours prévus en pointillés, trait coloré par l'échelle thermique |
| `Ticker` | `tr-ticker`, `tr-live`, `tr-track` | Bandeau LIVE en haut de chaque page |
| `Sticker` | `tr-sticker` (+ `r`, `flat`, `ghost`, `safe`, `caution`) | Catégorie, sécurité de marque, « Heatwave · day 4 » ; trois au plus par carte |
| `CountryTile` | (nouveau) | Tuile pays : fond de la couleur de sa tendance la plus chaude, drapeau, code, degré, nom de la tendance |
| `AngleCard` | `tr-angle` | Idée de post : photo, sticker, titre, exemple, réseaux conseillés, « Copy » / « Write it in upTake » |
| `Button` | `tr-btn primary / ink / line / small` | Primary en `heat-4`, un seul par écran |
| `PoweredBy` | `tr-powered` | Pastille « Powered by upTake » |
| `ApiSnippet` | `tr-code` | Exemple d'appel |
| `CooledCard` | `tr-story` + `tr-thermal cooled` | Tendance passée, photo en niveaux de gris |
| `Flag` | (nouveau) | Drapeau d'un pays |

Le champ thermique abstrait `tr-thermal` de `bundle.css` ne sert plus qu'en repli sans photo et pour `CooledCard`.

## Formes, espace, mouvement

- Carte story : 9:16, rayon 24 ; lignes et tuiles : rayon 14 ; boutons et stickers : pilules.
- Stickers inclinés de −3° ou +2,5°.
- Espacements par pas de 4 (`space-1` à `space-8`). Contenu centré, 1240 px au plus, marges 32 px (16 px sur téléphone).
- Mouvement : ticker continu, LIVE qui pulse, cartes qui entrent en glissant (320 ms), degré qui compte quand il change (400 ms au plus). Seulement `transform` et `opacity`. Tout s'arrête avec `prefers-reduced-motion`.
- Icônes `lucide-react`, trait 1,75. Aucune icône de flamme.

## Règles à ne pas casser

- Couleurs de chaleur pour la chaleur seulement (et le bouton principal).
- Une seule police, Archivo.
- De vraies photos en thermique, jamais d'illustration codée.
- Tout chiffre d'exemple porte « Example ». Toute donnée estimée (audiences) porte « estimated ».
- Une seule tendance du jour par écran, une seule carte avec `glow-hot`.
- Contraste 4,5:1 au moins dans les deux thèmes ; texte posé sur une photo toujours sur un dégradé sombre.
- « Powered by upTake » visible sur chaque page.
- Le site marche sur téléphone (360 px) sans défilement horizontal.
