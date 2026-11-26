// Types partagés par les pages et l'API v1 (CLAUDE.md § 6 et § 7).

export const CATEGORIES = [
  "gaming",
  "tech",
  "ai",
  "entertainment",
  "sport",
  "culture",
  "business",
  "design",
  "lifestyle",
  "food",
  "music",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const LIFESPANS = ["1-2 days", "3-7 days", "2+ weeks"] as const;
export type Lifespan = (typeof LIFESPANS)[number];

export const HEAT_LEVELS = ["cold", "mild", "warm", "hot", "scorching"] as const;
export type HeatLevel = (typeof HEAT_LEVELS)[number];

export type SourceName = "google" | "wikipedia" | "bluesky" | "hackernews";
export const FREE_SOURCES: SourceName[] = ["google", "wikipedia", "bluesky", "hackernews"];

export interface Audience {
  label: string;
  share: number;
}

export interface Angle {
  tag: string;
  title: string;
  example: string;
  fits: string;
}

export interface SourceLink {
  title: string;
  url: string;
}

export interface TrendImage {
  url: string;
  width: number;
  height: number;
  alt: string;
  avg_color: string | null;
  credit: { name: string; url: string };
  source_url: string;
  /** Interne (filtre thermique, docs/images.md § 4) : jamais servi par l'API, retiré par toPublicTrend. */
  tone?: number[] | null;
}

export interface CountryHeat {
  code: string;
  heat: number;
  rank: number;
}

/** Une tendance telle que servie par l'API v1 (§ 7). */
export interface PublicTrend {
  topic: string;
  slug: string;
  title: string;
  category: Category;
  why: string;
  lifespan: Lifespan;
  brand_safe: boolean;
  risk: string | null;
  audiences: Audience[];
  angles: Angle[];
  sources: SourceLink[];
  heat: number;
  heat_level: HeatLevel;
  heat_change: number;
  rank: number;
  forecast: number[];
  countries: CountryHeat[];
  first_seen: string;
  last_seen: string;
  expires_at: string;
  is_top: boolean;
  image: TrendImage | null;
  /** Ajouté (compatible) : le jour de la mesure, YYYY-MM-DD. */
  day: string;
}

/** Vue interne utilisée par les pages : le contrat public plus ce qu'il faut pour l'affichage. */
export interface TrendView extends PublicTrend {
  id: string;
  is_new: boolean;
  prev_rank: number | null;
  heatwave_days: number;
  cools_in_days: number | null;
  best_window: number[];
  curve_title: string;
  history: { day: string; heat: number }[];
  factors: SignalFactors;
  top3_countries: number;
  cooled: boolean;
  peak_heat: number | null;
  peak_day: string | null;
  updated_at: string | null;
}

export interface SignalFactors {
  search?: number | null;
  wikipedia?: number | null;
  news?: number | null;
}

export interface CountryOverview {
  code: string;
  name: string;
  heat: number;
  heat_level: HeatLevel | null;
  trend: { slug: string; title: string; heat: number } | null;
}
