-- trends° by upTake — schéma initial (CLAUDE.md § 4, § 5, § 7 ; docs/heat.md ; docs/images.md)
-- RLS activée partout, sans aucune politique : ni anon ni authenticated ne lisent quoi que ce soit.
-- Tout est lu et écrit côté serveur avec la clé service (qui contourne la RLS).

create extension if not exists pgcrypto;

-- ─── Signaux bruts (internes, jamais servis) ───────────────────────────────
create table public.signals (
  id bigint generated always as identity primary key,
  day date not null,
  source text not null check (source in ('google', 'wikipedia', 'bluesky', 'hackernews')),
  topic_key text not null,            -- normalizeTopic(raw_topic)
  raw_topic text not null,
  country text,                        -- ISO 3166-1 alpha-2, null = pas de pays (Wikipédia, Bluesky, HN)
  rank integer,
  value numeric,                       -- vues (Wikipédia), points (HN), score (Google) ; jamais exposé
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index signals_day_source_idx on public.signals (day, source);
create index signals_day_topic_idx on public.signals (day, topic_key);

-- ─── Tendances ─────────────────────────────────────────────────────────────
create table public.trends (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  topic text not null,
  topic_key text not null unique,
  signal_key text,                     -- clé du signal confirmé (interne)
  title text not null check (char_length(title) <= 28),
  category text not null check (category in ('gaming','tech','ai','entertainment','sport','culture','business','design','lifestyle','food','music','other')),
  why text not null check (char_length(why) <= 200),
  lifespan text not null check (lifespan in ('1-2 days','3-7 days','2+ weeks')),
  brand_safe boolean not null,
  risk text,
  audiences jsonb not null default '[]'::jsonb,
  angles jsonb not null default '[]'::jsonb,
  image_query text,
  sources jsonb not null default '[]'::jsonb,
  first_seen date not null,
  last_seen date not null,
  expires_at timestamptz not null,
  hidden boolean not null default false,  -- « Hide » dans /admin : masquage immédiat partout
  hidden_at timestamptz,
  peak_heat integer,
  peak_day date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trends_last_seen_idx on public.trends (last_seen desc);

-- Chaleur, rang et prévision par jour
create table public.trend_days (
  trend_id uuid not null references public.trends (id) on delete cascade,
  day date not null,
  heat integer not null check (heat between 0 and 100),
  heat_change integer not null default 0,
  rank integer not null,
  is_top boolean not null default false,
  is_new boolean not null default false,
  forecast integer[] not null,
  components jsonb not null default '{}'::jsonb, -- spread, strength, sources, momentum (interne)
  factors jsonb not null default '{}'::jsonb,    -- facteurs de croissance arrondis (« ×6.2 »)
  source_count integer not null default 0,
  top3_countries integer not null default 0,
  manual_top boolean not null default false,     -- « Make top » dans /admin
  updated_at timestamptz not null default now(),
  primary key (trend_id, day)
);
create index trend_days_day_idx on public.trend_days (day, rank);
create unique index trend_days_one_top_idx on public.trend_days (day) where is_top;

-- Chaleur et rang par pays et par jour
create table public.trend_countries (
  trend_id uuid not null references public.trends (id) on delete cascade,
  day date not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  heat integer not null check (heat between 0 and 100),
  rank integer not null,
  primary key (trend_id, day, country_code)
);
create index trend_countries_day_country_idx on public.trend_countries (day, country_code, heat desc);

-- Photos (docs/images.md § 2)
create table public.trend_images (
  id uuid primary key default gen_random_uuid(),
  trend_id uuid not null references public.trends (id) on delete cascade,
  pexels_id bigint not null,
  storage_path text not null,
  width integer not null,
  height integer not null,
  avg_color text,
  alt text not null,
  photographer text not null,
  photographer_url text not null,
  pexels_url text not null,
  query text not null,
  candidates jsonb not null default '[]'::jsonb, -- résultats gardés pour « Next photo »
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index trend_images_one_active_idx on public.trend_images (trend_id) where active;
create index trend_images_pexels_idx on public.trend_images (pexels_id, created_at desc);

-- ─── Suivi des exécutions ──────────────────────────────────────────────────
create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','failed','fallback','skipped')),
  attempt integer not null default 1,
  sources jsonb not null default '{}'::jsonb,   -- { google: { ok, items, ms, error } … }
  candidates integer not null default 0,
  searches integer not null default 0,
  search_urls jsonb not null default '[]'::jsonb,
  rejected jsonb not null default '[]'::jsonb,  -- sujets écartés et pourquoi
  trends_count integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  error text
);
create index analysis_runs_day_idx on public.analysis_runs (day desc, started_at desc);

create table public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (job in ('daily','hourly','manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','failed','skipped')),
  detail jsonb not null default '{}'::jsonb,
  error text
);
create index cron_runs_started_idx on public.cron_runs (started_at desc);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  day date not null,
  created_at timestamptz not null default now(),
  model text not null,
  purpose text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  web_searches integer not null default 0,
  cost_usd numeric(10, 4) not null default 0
);
create index ai_usage_day_idx on public.ai_usage (day);

-- Incidents (alerte admin une seule fois par incident, CLAUDE.md § 5.7)
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notified_at timestamptz,
  detail jsonb not null default '{}'::jsonb
);
create unique index incidents_one_open_idx on public.incidents (kind) where closed_at is null;

-- ─── Public : signalements, clés, liste d'attente ──────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  trend_id uuid references public.trends (id) on delete set null,
  slug text,
  reason text not null check (reason in ('sensitive','wrong','offensive','other')),
  message text check (char_length(message) <= 1000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,         -- SHA-256 hexadécimal, jamais la clé en clair
  prefix text not null,                  -- « tk_ab12 » pour l'affichage
  plan text not null check (plan in ('free','starter','pro','internal')),
  email text,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.api_usage (
  key_id uuid not null references public.api_keys (id) on delete cascade,
  period date not null,                  -- premier jour du mois
  count integer not null default 0,
  primary key (key_id, period)
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  kind text not null default 'api' check (kind in ('api','paid')),
  created_at timestamptz not null default now(),
  unique (email, kind)
);

-- Compteur atomique d'usage d'une clé (renvoie le total du mois après incrément)
create or replace function public.increment_api_usage(p_key_id uuid, p_period date)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.api_usage (key_id, period, count)
  values (p_key_id, p_period, 1)
  on conflict (key_id, period) do update set count = public.api_usage.count + 1
  returning count;
$$;
revoke all on function public.increment_api_usage(uuid, date) from public, anon, authenticated;

-- ─── RLS partout, aucune politique ─────────────────────────────────────────
alter table public.signals enable row level security;
alter table public.trends enable row level security;
alter table public.trend_days enable row level security;
alter table public.trend_countries enable row level security;
alter table public.trend_images enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.cron_runs enable row level security;
alter table public.ai_usage enable row level security;
alter table public.incidents enable row level security;
alter table public.reports enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_usage enable row level security;
alter table public.waitlist enable row level security;

-- ─── Stockage des photos : bucket public en lecture, écriture par la clé service ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trend-images', 'trend-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
