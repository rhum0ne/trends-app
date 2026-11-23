// Types de la base, écrits à la main d'après supabase/migrations/20261122000000_init.sql.
// À remplacer par la sortie de `pnpm db:types` une fois le projet Supabase créé (CHECKLIST.md).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel<Name extends string, Table extends string> = {
  foreignKeyName: Name;
  columns: ["trend_id"];
  isOneToOne: false;
  referencedRelation: Table;
  referencedColumns: ["id"];
};

type Table<Row, Required extends keyof Row = never, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

export type SignalRow = {
  id: number;
  day: string;
  source: "google" | "wikipedia" | "bluesky" | "hackernews";
  topic_key: string;
  raw_topic: string;
  country: string | null;
  rank: number | null;
  value: number | null;
  meta: Json;
  created_at: string;
};

export type TrendRow = {
  id: string;
  slug: string;
  topic: string;
  topic_key: string;
  signal_key: string | null;
  title: string;
  category: string;
  why: string;
  lifespan: string;
  brand_safe: boolean;
  risk: string | null;
  audiences: Json;
  angles: Json;
  image_query: string | null;
  sources: Json;
  first_seen: string;
  last_seen: string;
  expires_at: string;
  hidden: boolean;
  hidden_at: string | null;
  peak_heat: number | null;
  peak_day: string | null;
  created_at: string;
  updated_at: string;
};

export type TrendDayRow = {
  trend_id: string;
  day: string;
  heat: number;
  heat_change: number;
  rank: number;
  is_top: boolean;
  is_new: boolean;
  forecast: number[];
  components: Json;
  factors: Json;
  source_count: number;
  top3_countries: number;
  manual_top: boolean;
  updated_at: string;
};

export type TrendCountryRow = {
  trend_id: string;
  day: string;
  country_code: string;
  heat: number;
  rank: number;
};

export type TrendImageRow = {
  id: string;
  trend_id: string;
  pexels_id: number;
  storage_path: string;
  width: number;
  height: number;
  avg_color: string | null;
  alt: string;
  photographer: string;
  photographer_url: string;
  pexels_url: string;
  query: string;
  candidates: Json;
  active: boolean;
  created_at: string;
};

export type AnalysisRunRow = {
  id: string;
  day: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "failed" | "fallback" | "skipped";
  attempt: number;
  sources: Json;
  candidates: number;
  searches: number;
  search_urls: Json;
  rejected: Json;
  trends_count: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  error: string | null;
};

export type CronRunRow = {
  id: string;
  job: "daily" | "hourly" | "manual";
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "failed" | "skipped";
  detail: Json;
  error: string | null;
};

export type AiUsageRow = {
  id: number;
  day: string;
  created_at: string;
  model: string;
  purpose: string;
  input_tokens: number;
  output_tokens: number;
  web_searches: number;
  cost_usd: number;
};

export type IncidentRow = {
  id: string;
  kind: string;
  opened_at: string;
  closed_at: string | null;
  notified_at: string | null;
  detail: Json;
};

export type ReportRow = {
  id: string;
  trend_id: string | null;
  slug: string | null;
  reason: "sensitive" | "wrong" | "offensive" | "other";
  message: string | null;
  resolved: boolean;
  created_at: string;
};

export type ApiKeyRow = {
  id: string;
  key_hash: string;
  prefix: string;
  plan: "free" | "starter" | "pro" | "internal";
  email: string | null;
  label: string | null;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
};

export type ApiUsageRow = {
  key_id: string;
  period: string;
  count: number;
};

export type WaitlistRow = {
  id: string;
  email: string;
  kind: "api" | "paid";
  created_at: string;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      signals: Table<SignalRow, "day" | "source" | "topic_key" | "raw_topic">;
      trends: Table<TrendRow, "slug" | "topic" | "topic_key" | "title" | "category" | "why" | "lifespan" | "brand_safe" | "first_seen" | "last_seen" | "expires_at">;
      trend_days: Table<TrendDayRow, "trend_id" | "day" | "heat" | "rank" | "forecast", [Rel<"trend_days_trend_id_fkey", "trends">]>;
      trend_countries: Table<TrendCountryRow, "trend_id" | "day" | "country_code" | "heat" | "rank", [Rel<"trend_countries_trend_id_fkey", "trends">]>;
      trend_images: Table<TrendImageRow, "trend_id" | "pexels_id" | "storage_path" | "width" | "height" | "alt" | "photographer" | "photographer_url" | "pexels_url" | "query", [Rel<"trend_images_trend_id_fkey", "trends">]>;
      analysis_runs: Table<AnalysisRunRow, "day">;
      cron_runs: Table<CronRunRow, "job">;
      ai_usage: Table<AiUsageRow, "day" | "model" | "purpose">;
      incidents: Table<IncidentRow, "kind">;
      reports: Table<ReportRow, "reason">;
      api_keys: Table<ApiKeyRow, "key_hash" | "prefix" | "plan">;
      api_usage: Table<ApiUsageRow, "key_id" | "period">;
      waitlist: Table<WaitlistRow, "email">;
    };
    Views: { [_ in never]: never };
    Functions: {
      increment_api_usage: { Args: { p_key_id: string; p_period: string }; Returns: number };
      claim_lease: { Args: { p_job: string; p_holder: string; p_seconds: number }; Returns: boolean };
      release_lease: { Args: { p_job: string; p_holder: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
