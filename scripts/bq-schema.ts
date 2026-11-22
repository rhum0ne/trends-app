// `pnpm bq:schema` : affiche le schéma réel des tables Google Trends sur BigQuery et vérifie
// que les colonnes utilisées par src/lib/sources/google.ts existent. À lancer une fois les clés en place.

import { bigQueryClient, missingColumns, schemaQuery, type ColumnRow } from "../src/lib/sources/google";

async function main() {
  const bq = bigQueryClient();
  const [rows] = await bq.query({ query: schemaQuery(), location: "US" });
  const cols = rows as ColumnRow[];
  let table = "";
  for (const r of cols) {
    if (r.table_name !== table) {
      table = r.table_name;
      console.log(`\n${table}`);
    }
    console.log(`  ${r.column_name.padEnd(20)} ${r.data_type}`);
  }
  const missing = missingColumns(cols);
  console.log(missing.length ? `\nMISSING: ${missing.join(", ")} → update docs/heat.md and google.ts` : "\nAll required columns are present.");
  const [sample] = await bq.query({
    query: `SELECT country_code, term, rank, week, refresh_date FROM \`bigquery-public-data.google_trends.international_top_terms\`
            WHERE refresh_date = (SELECT MAX(refresh_date) FROM \`bigquery-public-data.google_trends.international_top_terms\` WHERE refresh_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
            ORDER BY week DESC, country_code, rank LIMIT 10`,
    location: "US",
  });
  console.log("\nSample (international_top_terms, latest refresh):");
  console.table(sample);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
