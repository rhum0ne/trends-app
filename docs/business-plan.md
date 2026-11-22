# Business plan — trends° by upTake

Version de référence pour le code. Le document de travail de l'humain est un Doc claude.ai (« Trends by upTake — Business plan ») ; ce fichier en reprend les décisions, mises à jour avec le choix d'un site séparé (`trends.uptake.me`) dès le départ.

## Résumé

trends° reste **100 % gratuit et d'abord au service d'upTake** ; il ne devient une offre payante que si des chiffres précis le justifient. Coût de fonctionnement estimé : **moins de 10 $ par mois** ; le vrai coût est le temps de l'humain.

- **Ce que c'est** : chaque jour, les tendances du moment, analysées pour un maker (pourquoi ça monte, durée de vie, où ça chauffe, risque pour une marque, angles de post).
- **Modèle** : gratuit, puis gratuit avec limites, puis offres payantes pour ceux qui veulent plus.
- **Ce qu'on en attend d'abord** : de meilleurs conseils dans upTake (moments « Trend ») et des visiteurs qui deviennent des utilisateurs d'upTake. Le revenu de l'API est un bonus éventuel.
- **Règle de décision** : on ne passe à la phase suivante que si les critères de passage sont atteints.

## Produit et positionnement

trends° vend une **analyse**, pas des données brutes : « the trend of the day, and how to use it for your product ».

- **Pour qui** : makers et fondateurs solo (via upTake), community managers et freelances, newsletters, outils de planification de posts, agents IA (plus tard, serveur MCP).
- **Chaque tendance contient** : nom, catégorie, chaleur en degrés et prévision, pays où elle chauffe, pourquoi ça monte, durée de vie, sûre ou non pour une marque, audiences, 2 ou 3 angles de post, une photo, des liens vers les sources.
- **N'en fait pas partie** : la liste brute des sources (Google Trends, Bluesky, Hacker News, Wikipédia), qui reste interne.

| Offre | Horizon | Analyse pour une marque | Prix |
| --- | --- | --- | --- |
| **trends° by upTake** | Jour et semaine, par pays | Oui : sécurité, angles, durée de vie | Gratuit, puis limité |
| Exploding Topics API | Tendances de fond, plusieurs mois | Non | Pro Business dès 249 $/mois + API dès 1 000 $/mois |
| Google Trends (site, flux RSS) | Jour | Non | Gratuit, sans API officielle ouverte |
| Veille d'entreprise (Brandwatch, Meltwater) | Temps réel | Partielle | Contrats estimés à 15 000 $+ par an |

Le créneau : rapide, abordable, beau à partager et pensé pour publier, là où les autres sont chers, lents ou bruts.

## Phases

| Phase | Contenu |
| --- | --- |
| 0 · Interne | Collecte, analyse, API lue par upTake (moments « Trend ») ; site public fermé |
| 1 · Site public | `trends.uptake.me` ouvert, gratuit, « Powered by upTake » partout |
| 2 · API gratuite avec clé | Clés gratuites limitées |
| 3 · Offres payantes | Starter et Pro (Paddle) |

Chaque phase garde la précédente : le site reste gratuit même quand l'API devient payante, et upTake utilise trends° dans tous les cas.

## Limites de l'usage gratuit

| | Sans clé | Clé gratuite | Starter (plus tard) | Pro (plus tard) |
| --- | --- | --- | --- | --- |
| Requêtes | 30 par jour et par IP | 1 000 par mois | 20 000 par mois | 100 000 par mois |
| Tendances | Tendance du jour seulement | Les 10 du jour | Toutes, avec filtres | Toutes, avec filtres |
| Angles de post | Non | 1 par tendance | Tous | Tous |
| Historique | Aucun | 7 jours | 90 jours | 12 mois |
| Pays | Monde | Monde + 1 pays | Tous | Tous |
| Webhook « nouvelle tendance », serveur MCP | Non | Non | Non | Oui |
| Mention « Powered by upTake » | Obligatoire | Obligatoire | Non | Non |
| Usage dans un produit vendu | Non | Non | Oui | Oui |
| Prix indicatif | Gratuit | Gratuit | 19 €/mois | 79 €/mois |

Les utilisateurs d'upTake ne passent pas par ces limites. Les prix sont des ordres de grandeur à valider, pas un tarif.

## Coûts

| Poste | Hypothèse | Coût mensuel estimé |
| --- | --- | --- |
| Recherche web Claude | 8 recherches par jour, 10 $ les 1 000 | environ 2,40 $ |
| Tokens du modèle fort | environ 30 000 en entrée et 4 000 en sortie par jour | environ 3 $ |
| Google Trends sur BigQuery | Palier gratuit de 1 To de requêtes par mois | 0 $ |
| Wikipédia, Bluesky, Hacker News | API gratuites | 0 $ |
| Pexels | API gratuite, une recherche par nouvelle tendance | 0 $ |
| Hébergement | Le VPS d'upTake déjà payé, réponses en cache | 0 $ en plus |
| Paddle (phase 3) | Environ 5 % + 0,50 $ par transaction, à vérifier | proportionnel aux ventes |
| **Total en argent** | | **environ 6 $** |
| Temps de l'humain | Relecture, sources qui changent, signalements | 1 à 2 h par semaine |

Le chiffre à surveiller est le temps : au-delà de 4 h par semaine, trends° prend sur upTake.

## Ce que trends° rapporte à upTake

1. **De meilleurs conseils** : les moments « Trend » donnent aux makers une raison de poster cette semaine, même sans release. À suivre : part des moments « Trend » écrits ou postés, contre ceux écartés.
2. **Des visiteurs** : les pages de `trends.uptake.me` attirent des recherches qui montent vite. Chaque « Write it in upTake » et « Powered by upTake » porte un lien suivi (`?ut=trends`), donc les inscriptions venues de trends° apparaissent dans upTake comme n'importe quelle source. Le site lui-même est mesuré par le script upTake installé dessus.
3. **Une démonstration** : « upTake te prévient quand une tendance colle à ton produit » se montre en une capture, et les cartes story se partagent.

Ordre de grandeur, à vérifier : 3 000 visiteurs par mois avec 1 % d'inscriptions donneraient 30 nouveaux comptes upTake par mois.

## Go / no-go

| Passage | Critères (tous requis) | Si ce n'est pas atteint |
| --- | --- | --- |
| **A** · Interne → site public | 2 semaines de tendances relues sans sujet sensible passé · au moins 5 tendances valides 80 % des jours · coût sous 10 $ par mois | Ajuster sources et filtre, rester interne |
| **B** · Site public → API gratuite avec clé | 1 000 visiteurs par mois pendant 2 mois · au moins 10 demandes d'accès à l'API | Garder le site seul |
| **C** · API gratuite → offres payantes | 100 clés actives (un appel par semaine au moins) · 20 inscrits sur la liste d'attente payante · conditions des sources vérifiées par écrit | Rester gratuit avec limites |
| **D** · Offres payantes → produit à part entière | 1 000 € de revenu mensuel pendant 3 mois · l'API sert plus hors d'upTake que dans upTake | Rester un produit d'appoint d'upTake |
| **Arrêt** | Moins de 300 visiteurs par mois après 6 mois de site public, ou plus de 4 h de maintenance par semaine | Fermer le site, garder les moments « Trend » dans upTake |

## Risques

| Risque | Ce qui arrive | Comment le limiter |
| --- | --- | --- |
| Temps de maintenance | trends° prend sur upTake | Tout automatique, relecture 10 min par jour au début, critère d'arrêt |
| Sujet sensible publié | Une marque reprend un drame, mauvaise image | Double filtre (IA + liste de mots), « Hide » dans `/admin`, signalement public |
| Conditions des sources ou des images | Une source interdit un usage | API qui ne renvoie que l'analyse et des liens ; conditions lues et datées dans `docs/sources.md` |
| Source qui disparaît | Moins de tendances | Au moins 4 sources, alerte si moins de 2 répondent |
| Qualité moyenne | Tendances sans intérêt pour un maker | Mieux vaut 3 bonnes que 10 moyennes ; mesurer les moments écartés |
| Coût de l'IA qui dérive | Plus de recherches ou de tokens | Plafond quotidien, 8 recherches au plus |

## Les 90 premiers jours

- **Mois 1 · construire en interne** : dépôt, pipeline, API, admin ; upTake lit l'API sur le projet de l'humain seulement ; relecture 10 min par jour.
- **Mois 2 · fiabiliser** : ajuster sources, filtre et chaleur ; ouvrir les moments « Trend » à tous les projets upTake ; lire la licence BigQuery Google Trends, les consignes Bluesky et les conditions Pexels.
- **Mois 3 · site public, si le passage A est atteint** : ouvrir `trends.uptake.me` (pages tendance en `noindex` au début), formulaire « Get API access » (liste d'attente), faire le point.
