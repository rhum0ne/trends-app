// Google Trends : jeu de données public BigQuery `bigquery-public-data.google_trends`.
// - international_top_terms / international_top_rising_terms : une cinquantaine de pays, rafraîchi chaque jour ;
// - top_terms / top_rising_terms : États-Unis.
// Le schéma réel n'a pas pu être lu depuis la fiche officielle : il est vérifié à chaque collecte
// (INFORMATION_SCHEMA.COLUMNS) et `pnpm bq:schema` l'affiche. Colonnes attendues : docs/heat.md.

import { BigQuery, type BigQueryOptions } from "@google-cloud/bigquery";
import { normalizeTopic } from "@/lib/normalize";
import { env } from "@/lib/env";
import { TOP_N } from "@/lib/heat";
import { runSource, SOURCE_TIMEOUT_MS, type SourceItem, type SourceResult } from "./types";

export const DATASET = "bigquery-public-data.google_trends";

/** Colonnes dont la requête a besoin, par table. */
export const REQUIRED_COLUMNS: Record<string, string[]> = {
  international_top_terms: ["term", "rank", "week", "refresh_date", "country_code"],
  international_top_rising_terms: ["term", "rank", "week", "refresh_date", "country_code"],
  top_terms: ["term", "rank", "week", "refresh_date"],
  top_rising_terms: ["term", "rank", "week", "refresh_date"],
};

// Garde-fou de coût : la requête échoue plutôt que de facturer plus (palier gratuit 1 To/mois).
const MAX_BYTES_BILLED = String(30 * 1024 ** 3);

export function bigQueryClient(): BigQuery {
  const opts: BigQueryOptions = {};
  const project = env("GOOGLE_CLOUD_PROJECT");
  if (project) opts.projectId = project;
  const json = env("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (json) {
    const text = json.startsWith("{") ? json : Buffer.from(json, "base64").toString("utf8");
    const creds = JSON.parse(text) as { client_email: string; private_key: string; project_id?: string };
    opts.credentials = { client_email: creds.client_email, private_key: creds.private_key };
    if (!opts.projectId && creds.project_id) opts.projectId = creds.project_id;
  }
  return new BigQuery(opts);
}

export interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
}

export function schemaQuery(): string {
  return `SELECT table_name, column_name, data_type
FROM \`${DATASET}.INFORMATION_SCHEMA.COLUMNS\`
WHERE table_name IN (${Object.keys(REQUIRED_COLUMNS).map((t) => `'${t}'`).join(", ")})
ORDER BY table_name, ordinal_position`;
}

/** Liste des colonnes manquantes ; vide si le schéma convient. */
export function missingColumns(rows: ColumnRow[]): string[] {
  const have = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
  const missing: string[] = [];
  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) for (const c of cols) if (!have.has(`${table}.${c}`)) missing.push(`${table}.${c}`);
  return missing;
}

/**
 * Pour chaque table : la dernière actualisation (refresh_date, 7 derniers jours pour limiter les partitions lues),
 * puis la semaine la plus récente de cette actualisation. Le rang retenu par pays est le meilleur (MIN) :
 * correct que `rank` soit national ou par région.
 */
export function trendsQuery(): string {
  const part = (table: string, country: string, kind: "top" | "rising") => `
  SELECT ${country} AS country_code, term, MIN(rank) AS rank, '${kind}' AS kind
  FROM \`${DATASET}.${table}\` t
  WHERE refresh_date = (SELECT MAX(refresh_date) FROM \`${DATASET}.${table}\` WHERE refresh_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
    AND week = (SELECT MAX(week) FROM \`${DATASET}.${table}\` WHERE refresh_date = (SELECT MAX(refresh_date) FROM \`${DATASET}.${table}\` WHERE refresh_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)))
    AND rank <= ${TOP_N}
  GROUP BY 1, 2`;
  return [
    part("international_top_terms", "UPPER(t.country_code)", "top"),
    part("international_top_rising_terms", "UPPER(t.country_code)", "rising"),
    part("top_terms", "'US'", "top"),
    part("top_rising_terms", "'US'", "rising"),
  ].join("\nUNION ALL");
}

export interface GoogleRow {
  country_code: string;
  term: string;
  rank: number | string;
  kind: "top" | "rising";
}

/**
 * Un élément par (pays, terme) ; un terme présent en « top » et en « rising » garde son meilleur rang.
 * Renvoie aussi la liste des pays suivis ce jour-là.
 */
export function aggregateGoogleRows(rows: GoogleRow[]): { items: SourceItem[]; trackedCountries: string[] } {
  const best = new Map<string, SourceItem>();
  const countries = new Set<string>();
  for (const r of rows) {
    const cc = String(r.country_code ?? "").toUpperCase();
    const rank = Number(r.rank);
    if (!/^[A-Z]{2}$/.test(cc) || !r.term || !Number.isFinite(rank) || rank < 1 || rank > TOP_N) continue;
    countries.add(cc);
    const key = normalizeTopic(r.term);
    if (!key) continue;
    const id = `${cc}|${key}`;
    const cur = best.get(id);
    if (!cur || rank < (cur.rank ?? Infinity)) {
      best.set(id, { source: "google", raw: r.term, key, country: cc, rank, value: null, meta: { kind: r.kind } });
    }
  }
  return { items: [...best.values()], trackedCountries: [...countries].sort() };
}

export function fetchGoogleTrends(): Promise<SourceResult> {
  return runSource("google", async () => {
    if (!env("GOOGLE_CLOUD_PROJECT") && !env("GOOGLE_SERVICE_ACCOUNT_JSON") && !env("GOOGLE_APPLICATION_CREDENTIALS")) {
      throw new Error("google: BigQuery credentials are not set");
    }
    const bq = bigQueryClient();
    const common = { location: "US", jobTimeoutMs: SOURCE_TIMEOUT_MS, maximumBytesBilled: MAX_BYTES_BILLED };
    const [[schemaRows], [rows]] = await Promise.all([bq.query({ query: schemaQuery(), ...common }), bq.query({ query: trendsQuery(), ...common })]);
    const missing = missingColumns(schemaRows as ColumnRow[]);
    if (missing.length) throw new Error(`google: BigQuery schema changed, missing ${missing.join(", ")}`);
    const out = aggregateGoogleRows(rows as GoogleRow[]);
    if (out.items.length === 0) throw new Error("google: no rows for the latest refresh");
    return out;
  });
}
