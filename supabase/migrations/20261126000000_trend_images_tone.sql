-- Courbe de tonalité de chaque photo (docs/images.md § 4) : 11 valeurs de 0 à 1, calculées à la copie
-- (sharp) et appliquées avant la palette thermique, pour qu'une photo sombre ou claire soit aussi lisible
-- qu'une autre. Null = pas encore calculée (le rafraîchissement horaire rattrape les photos actives).
alter table public.trend_images add column tone real[];
