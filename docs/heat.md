# Chaleur, prévision, pays — trends°

Tout ici est **déterministe et sans IA** : fonctions pures dans `src/lib/heat/`, testées par Vitest, avec leurs constantes en tête de fichier. Les pondérations ci-dessous sont un point de départ à ajuster après deux semaines de relecture ; tout changement de formule est noté ici.

## Chaleur (0–100)

Pour une tendance `t` un jour `d`, chaque composante est ramenée entre 0 et 1 :

| Composante | Calcul | Poids |
| --- | --- | --- |
| `spread` | part des pays suivis où le sujet est dans le top 25 Google Trends ce jour-là | 0,35 |
| `strength` | rang moyen dans les pays où il apparaît : `1 - (rang moyen - 1) / 25` | 0,25 |
| `sources` | nombre de sources gratuites qui le citent ce jour, sur 4 | 0,20 |
| `momentum` | progression : `clamp((spread_d - spread_{d-1}) * 4 + 0.5, 0, 1)` ; sujet nouveau = 1 | 0,20 |

`heat = round(100 * somme pondérée)`, bornée 0–100.

- Niveau : `cold` < 40 ≤ `mild` < 60 ≤ `warm` < 75 ≤ `hot` < 90 ≤ `scorching`.
- **Heatwave** : chaleur ≥ 90 deux jours de suite ou plus (« Heatwave · day N »).
- `heat_change` = chaleur du jour − chaleur de la veille (0 pour un sujet nouveau, affiché « NEW »).
- Rafraîchissement `hourly` : seule la composante `sources` peut changer en cours de journée ; le reste est quotidien.

## Chaleur par pays

Pour chaque tendance publiée et chaque pays suivi où elle apparaît : `heat_country = round(100 * (0.6 * strength_pays + 0.4 * momentum_pays))`.

- Les pays viennent de `international_top_terms` (une cinquantaine) et de `top_terms` pour les États-Unis.
- La tuile d'un pays prend la chaleur de **sa** tendance publiée la plus chaude.
- Un pays n'affiche que des tendances publiées (analysées et sûres) : jamais un terme brut de Google. S'il n'en a aucune, sa tuile est grise (« No trend we cover today »).

## Rang

- Rang du jour = ordre par chaleur des tendances publiées. ▲ / ▼ par rapport au rang de la veille, « NEW » si absent la veille.
- Classement de la semaine = chaleur moyenne des 7 derniers jours (jours absents comptés 0).

## Prévision (5 jours)

Modèle simple de refroidissement, à partir de la chaleur du jour `h0`, de la tendance récente et de `lifespan` :

- Demi-vie : `1-2 days` → 1,5 jour ; `3-7 days` → 3 jours ; `2+ weeks` → 10 jours.
- Si la chaleur a monté les 2 derniers jours, le jour +1 vaut `min(100, h0 + (h0 - h_{-1}) / 2)` (pic probable), puis décroissance.
- Décroissance : `h(n) = round(h_pic * 0.5^(n / demi_vie))`.
- « Cools in ~N days » = premier jour où la prévision passe sous 60. « Best window to post » = les jours de prévision ≥ 75 (au plus 2), sinon « today ».
- Titre de la courbe (`/t/{slug}`), par règle : pic à venir → « peak tomorrow, then it cools » ; déjà en baisse → « past its peak » ; stable → « holding steady ».
- `expires_at` = jour où la prévision passe sous 40, 14 jours au plus.

## Facteurs « signals »

Rapport entre la valeur du jour et la moyenne des 7 jours précédents, par source disponible (Wikipédia : vues ; Google : nombre de pays dans le top 25 ; Hacker News : points). Arrondi à une décimale, affiché « ×6.2 ». Jamais les valeurs brutes.

## Tests attendus

Chaleur bornée, monotonie (plus de pays → plus chaud), sujet nouveau, heatwave, prévision (pic puis décroissance, durées), `expires_at` ≤ 14 jours, pays sans tendance.

## Précisions d'implémentation (2026-11-22)

Notées en écrivant `src/lib/heat/` et `src/lib/pipeline/score.ts` ; à relire par l'humain.

### Données Google Trends (BigQuery) — schéma à confirmer

La fiche officielle du jeu de données n'a pas pu être lue (console Google non accessible ici) et aucun outil `gcloud` n'était disponible : **le schéma n'est pas confirmé**. Colonnes utilisées par la requête, d'après les articles de Google de 2021 et les exemples publiés :

| Table | Colonnes utilisées |
| --- | --- |
| `international_top_terms`, `international_top_rising_terms` | `country_code`, `term`, `rank`, `week`, `refresh_date` |
| `top_terms`, `top_rising_terms` (États-Unis) | `term`, `rank`, `week`, `refresh_date` |

- À chaque collecte, `INFORMATION_SCHEMA.COLUMNS` est lu : une colonne manquante fait échouer la source Google avec un message clair (les autres sources continuent). `pnpm bq:schema` affiche le schéma réel et un échantillon.
- On lit la dernière actualisation (`refresh_date` max des 7 derniers jours, pour ne lire que quelques partitions), puis la semaine la plus récente de cette actualisation (`week` max).
- **Rang par pays** = `MIN(rank)` sur les lignes du pays : correct que `rank` soit national (même valeur dans chaque région) ou par région. Les termes « rising » comptent aussi : un pays « a » le sujet si le terme est dans le top 25 ou les rising 25, au meilleur rang des deux.
- Pays suivis un jour donné = pays présents dans ces données ce jour-là (+ `US` via `top_terms`).
- Un terme Google correspond à une tendance si tous les mots significatifs de la tendance (ou de son signal) sont dans le terme (`matchesTopic`) : « gta 6 » couvre « gta 6 trailer ».
- Garde-fou de coût : `maximumBytesBilled` = 30 Go par requête.

### Précisions de formules

- `sources` : les 4 sources gratuites sont Google Trends, Wikipédia, Bluesky, Hacker News. Une source « cite » le sujet si l'un de ses éléments du jour lui correspond (`matchesTopic`).
- « Sujet nouveau » : pas de ligne `trend_days` la veille (même s'il a existé avant).
- `momentum_pays` (non défini plus haut) : absent la veille dans ce pays → 1 ; sinon `clamp(0.5 + (rang_veille − rang_jour) / 10, 0, 1)`.
- Rang dans un pays : ordre par `heat_country` parmi les tendances publiées ce jour-là.
- Tendance du jour : la plus chaude parmi les sûres (`brand_safe`) ; « Make top » dans `/admin` la remplace pour la journée.
- Prévision : 5 valeurs = aujourd'hui (`h0`) puis J+1 à J+4. « Pic à venir » = chaleur en hausse sur les deux derniers jours (`h0 > h-1 > h-2`). Sans pic : `h(n) = h0 × 0,5^(n / demi-vie)` ; avec pic : `h(1) = pic`, puis `h(n) = pic × 0,5^((n − 1) / demi-vie)`.
- « Cools in ~N days » : premier `n ≥ 0` où la projection passe sous 60 (0 = « cooling now ») ; au-delà de 14 jours : « holding for now ».
- « Best window » : les jours de prévision ≥ 75, les 2 plus chauds au plus, dans l'ordre des jours ; aucun → « today ».
- Titres de courbe ajoutés : sujet nouveau → « just heating up » ; hausse de plus de 2° sans pic prévu → « heating up ». Baisse de plus de 2° → « past its peak » ; sinon « holding steady ».
- `expires_at` : début (UTC) du premier jour `n ≥ 1` où la projection passe sous 40, 14 jours au plus.
- Rafraîchissement `hourly` : Wikipédia, Bluesky et Hacker News sont relus ; Google garde sa contribution du matin ; une source en panne garde aussi la sienne (la chaleur ne baisse pas à cause d'une panne).
- Facteurs « signals » : recherche = nombre de pays Google du jour / moyenne des 7 jours précédents (pris dans `trend_days.components`) ; Wikipédia = vues ; actualité tech = points Hacker News. Absent si pas d'historique.
