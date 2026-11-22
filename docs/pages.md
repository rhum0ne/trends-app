# Pages publiques — trends°

Toutes les pages partagent : le **ticker LIVE** (tendances du jour avec leur degré, défilement continu), l'**en-tête** (logo `trends°`, navigation Today · This week · By country · API, pastille « Powered by upTake ») et le **pied de page** (logo, « The internet's weather report, for makers. », « Turn a trend into visits with upTake », « Photos provided by Pexels », « Data source: Google Trends », choix du thème night/day, Report a trend).

Données : uniquement ce que sert notre propre API (`src/lib/trends/queries.ts` appelé par les pages et par `/api/v1`, mêmes fonctions). Pages rendues côté serveur, revalidées toutes les 10 minutes.

## `/` — accueil

De haut en bas :

1. **La tendance du moment, worldwide** (`TrendHero`)
   - Photo thermique de la tendance en fond, plein cadre, avec un dégradé sombre à gauche pour le texte ; crédit Pexels discret en bas à droite.
   - « Right now · worldwide », stickers (catégorie, Brand-safe, « Heatwave · day N » si au-dessus de 90° depuis plusieurs jours).
   - Titre géant en minuscules, phrase « why ».
   - Degré en grand (`HeatBadge xl`), variation « ▲ 12° since yesterday » (Archivo 800, couleur `safe` ou `ink-muted`), « #1 in 41 of 50 countries » suivi des drapeaux des 6 à 8 pays les plus chauds.
   - Deux boutons : « Read the trend » (primary) vers `/t/{slug}`, « 3 ways to post about it » (line) vers les angles de la page tendance.
2. **Bandeau prévision** sous le héros : prévision 5 jours (barres colorées) avec « Best window: today and Monday », et l'échelle « How hot is hot? » (cold → scorching).
3. **« also heating up »** : trois cartes story (`TrendCard`) tirées au hasard parmi les autres tendances du jour, bouton **Shuffle** qui en tire trois autres (côté navigateur, sans requête : les 10 tendances sont déjà dans la page). Chaque carte : photo thermique en haut, drapeaux des pays principaux (ou « Worldwide »), catégorie, Brand-safe ou Caution, titre, why, degré, « cools in ~N days ». Lien vers `/t/{slug}`.
4. **« by country »** : grille de tuiles (`CountryTile`), une par pays suivi, fond de la couleur de sa tendance la plus chaude (« the world in thermal »), drapeau, code, degré, nom de la tendance. Un clic sélectionne le pays (`aria-pressed`) et remplit le panneau sous la grille, en pleine largeur : drapeau en grand, nom du pays, photo thermique de sa tendance n° 1, top 3 du pays (`TrendRow`), une phrase de contexte, lien « Full chart for {country} » vers `/c/{code}`. Pays sélectionné par défaut : celui du visiteur (en-tête pays de Cloudflare, jamais stocké), sinon les États-Unis. Afficher 12 pays sur l'accueil (les plus actifs), « All 50 countries » vers `/c`.
5. **« this week, worldwide »** : classement des 6 à 10 tendances de la semaine (`TrendRow` avec vignette photo), rang, ▲ / ▼ / NEW, courbe 7 jours, degré.
6. **Encart API** : « the forecast, as json », une phrase, bouton « Read the API docs », exemple d'appel.
7. Pied de page.

Sans tendance du jour (pipeline en échec) : la dernière tendance encore valide avec « Updated {date} ». Jamais de page vide.

## `/t/{slug}` — une tendance

1. Fil d'Ariane : Today / {Category} / {title}.
2. **Héros** : photo thermique en fond, stickers, titre géant, why, quatre chiffres (chaleur, variation depuis la veille, première apparition, « ~N days before it cools »), boutons « See 3 post angles » (primary) et « Share the card ». À droite, la **carte story partageable** (9:16) ; « Share the card » télécharge une image PNG de la carte (rendue côté serveur, `next/og`, avec « trends.uptake.me » dessus) ou ouvre le partage natif sur téléphone.
3. **Courbe de chaleur** (`HeatCurve`) : 7 jours mesurés (trait coloré par l'échelle thermique, aire légère) et 4 jours de prévision en pointillés sur fond `surface-2` ; repères 40°, 60°, 75°, 90° ; titre parlant (« peak tomorrow, then it cools ») choisi par règle selon la prévision, jamais par l'IA ; légende Measured / Forecast ; phrase qui explique la chaleur.
4. **« where it's hot »** : les 8 pays les plus chauds, drapeau, nom, barre de chaleur colorée, degré ; mention « #2 there » quand la tendance n'est pas n° 1 du pays ; lien « All countries ».
5. **« audiences »** : 2 à 4 audiences avec leur part (barres), mention « estimated ».
6. **« 3 ways to post about it »** : `AngleCard` (photo thermique, sticker, titre, exemple, réseaux conseillés, « Copy » et « Write it in upTake » avec le lien suivi). Phrase d'en-tête : « Talk about the moment, not the brand. »
7. **« brand safety »** : sticker Brand-safe ou Caution et 3 ou 4 règles (ce qu'on peut évoquer, pas de logo ni de visuel, pas de partenariat sous-entendu, le risque de `risk`).
8. **« signals »** : comment la tendance a monté, sans données brutes : facteurs de croissance arrondis (« ▲ ×6.2 in 7 days » pour la recherche, la vidéo, l'actualité selon les sources disponibles), nombre de pays où elle est dans le top 3, heure de mise à jour, liens vers les sources de l'analyse.
9. **« related trends »** : 3 tendances de la même catégorie ou des mêmes pays (vignette, titre, catégorie, degré).
10. Pied de page.

Tendance expirée : même page en version `CooledCard` (photo en gris, « This trend has cooled. It peaked at 91° on Oct 31. », bouton vers aujourd'hui), jamais de suggestion de poster.

## `/c` et `/c/{code}` — pays

- `/c` : toutes les tuiles pays (une cinquantaine), triées par chaleur.
- `/c/{code}` : drapeau et nom, tendance n° 1 du pays en héros réduit, top 10 du jour, classement de la semaine du pays. `noindex` tant que le pays n'a pas 7 jours de données.

## `/archive`

Les tendances du jour des 30 derniers jours, une `CooledCard` ou `TrendCard` par jour.

## `/api`

Documentation de `v1` (points d'accès, champs, limites, exemples), formulaire « Get API access » (liste d'attente en phase 1, clé gratuite en phase 2), rappel « Powered by upTake » obligatoire en gratuit.

## Partage et référencement

- Chaque page a son image Open Graph générée (la carte story de la tendance, 1200×630 et 1080×1920).
- Titres de page : « {title} is heating up · trends° » (60 caractères au plus).
- Le script de mesure d'upTake est installé sur le site (lien suivi `?ut=trends` vers upTake).
