-- Analyse incrémentale (CLAUDE.md § 5) : date de la dernière analyse IA d'une tendance.
-- Une tendance connue garde son analyse tant qu'elle a moins de 3 jours, n'a pas expiré et ne bondit pas.
alter table public.trends add column analyzed_at timestamptz;
update public.trends set analyzed_at = updated_at where analyzed_at is null;
