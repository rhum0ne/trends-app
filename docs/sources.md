# Sources et conditions d'utilisation

Une ligne par source, remplie **après lecture de la page officielle** : rien n'est affirmé sans lien et sans date de lecture. Une source sans ligne remplie n'est pas activée en production.

**État au 2026-11-22** : seule la licence des drapeaux a été lue (fichier `LICENSE` du paquet installé). Toutes les autres lignes restent **à lire par l'humain** ; les liens indiqués sont les pages officielles probables, à confirmer en les ouvrant.

| Source | Usage dans trends° | Conditions (lien) | Lue le | Ce qui est permis / obligatoire | Statut |
| --- | --- | --- | --- | --- | --- |
| Google Trends (BigQuery `google_trends`) | Top et rising terms par pays | Fiche Marketplace « Google Trends » : https://console.cloud.google.com/marketplace/product/bigquery-public-datasets/google-search-trends (non lisible sans console) | — | à remplir (attribution « Data source: Google Trends », affichée sur le site) | à lire |
| Wikipédia Pageviews API | Articles les plus vus | https://wikimedia.org/api/rest_v1/ et politique User-Agent : https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy | — | à remplir (User-Agent avec contact : `WIKIMEDIA_CONTACT`) | à lire |
| Bluesky `getTrendingTopics` | Sujets du moment | https://docs.bsky.app/ (consignes développeurs) | — | à remplir (point d'accès non stabilisé) | à lire |
| Hacker News (Algolia) | Première page 24 h | https://hn.algolia.com/api | — | à remplir | à lire |
| Claude, outil de recherche web | Analyse quotidienne | https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool | — | afficher les sources des résultats (fait : section « signals » et champ `sources`) | à lire |
| Pexels API | Photos des tendances | https://www.pexels.com/api/documentation/ ; licence : https://www.pexels.com/license/ | — | à remplir (crédit, limites 200/h et 20 000/mois par défaut) | à lire |
| Drapeaux (`flag-icons` 7.6.0) | Composant `Flag` | Licence MIT, fichier `LICENSE` du paquet npm `flag-icons` (© 2013 Panayiotis Lipiridis) ; https://github.com/lipis/flag-icons | 2026-11-22 | Usage, copie, modification et usage commercial permis ; garder la mention de copyright et de licence dans les copies (copiée dans `public/flags/LICENSE` par `scripts/copy-flags.mjs`) | lu |
| Archivo (Google Fonts) | Police unique, chargée par `next/font` et pour les images Open Graph | https://fonts.google.com/specimen/Archivo/license (SIL Open Font License 1.1, à confirmer) | — | à remplir | à lire |
| Resend (facultatif) | Email d'alerte admin | https://resend.com/legal/terms-of-service | — | service d'envoi, pas une source de données ; choix du fournisseur à confirmer | à décider |
