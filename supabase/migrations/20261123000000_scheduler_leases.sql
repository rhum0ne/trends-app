-- Superviseur des tâches (CLAUDE.md § 5) : un bail par tâche pour qu'un seul conteneur lance
-- l'analyse ou le rafraîchissement, même pendant un déploiement où deux instances tournent.

create table public.scheduler_leases (
  job text primary key,
  holder text not null,
  until timestamptz not null
);
alter table public.scheduler_leases enable row level security;

-- Prend le bail s'il est libre (expiré) ou déjà à nous. Renvoie true si on l'a.
create or replace function public.claim_lease(p_job text, p_holder text, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.scheduler_leases (job, holder, until)
  values (p_job, p_holder, now() + make_interval(secs => p_seconds))
  on conflict (job) do update
    set holder = excluded.holder, until = excluded.until
    where public.scheduler_leases.until <= now() or public.scheduler_leases.holder = excluded.holder;
  return found;
end;
$$;

-- Rend le bail (seulement s'il est à nous).
create or replace function public.release_lease(p_job text, p_holder text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.scheduler_leases set until = now() where job = p_job and holder = p_holder;
$$;

revoke all on function public.claim_lease(text, text, integer) from public, anon, authenticated;
revoke all on function public.release_lease(text, text) from public, anon, authenticated;
grant execute on function public.claim_lease(text, text, integer) to service_role;
grant execute on function public.release_lease(text, text) to service_role;
