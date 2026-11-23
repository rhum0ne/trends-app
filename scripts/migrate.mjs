// Applique les migrations de supabase/migrations/ qui ne le sont pas encore (équivalent de `supabase db push`).
// Lancé au démarrage du conteneur, avant le serveur (Dockerfile), et en local par `pnpm db:migrate`.
//
// - Même table de suivi que la CLI Supabase (supabase_migrations.schema_migrations) : les deux restent compatibles.
// - Chaque fichier dans sa propre transaction, avec un verrou consultatif : deux conteneurs qui démarrent
//   en même temps n'appliquent jamais deux fois la même migration.
// - DATABASE_URL absente : rien à faire, le serveur démarre quand même.
// - Migration en échec : code de sortie 1, le nouveau conteneur ne démarre pas et Coolify garde l'ancien.
//
// Fichier JavaScript sans dépendance au reste du projet : il est copié tel quel dans l'image.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const LOCK_KEY = 72_816_455; // arbitraire, propre à trends°
const here = dirname(fileURLToPath(import.meta.url));

function migrationsDir() {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  const inImage = join(here, "migrations");
  return existsSync(inImage) ? inImage : join(here, "..", "supabase", "migrations");
}

function readMigrations(dir) {
  return readdirSync(dir)
    .map((file) => /^(\d+)_(.+)\.sql$/.exec(file))
    .filter(Boolean)
    .map(([file, version, name]) => ({ version, name, sql: readFileSync(join(dir, file), "utf8") }))
    .sort((a, b) => a.version.localeCompare(b.version));
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log("[migrate] DATABASE_URL not set: skipped");
    return;
  }
  const migrations = readMigrations(migrationsDir());
  const sql = postgres(url, { max: 1, connect_timeout: 15, idle_timeout: 5, onnotice: () => {} });
  try {
    // Sous le verrou aussi : « if not exists » n'empêche pas une collision entre deux démarrages simultanés
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${LOCK_KEY})`;
      await tx.unsafe(`
        create schema if not exists supabase_migrations;
        create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
      `);
    });
    let applied = 0;
    for (const m of migrations) {
      const done = await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${LOCK_KEY})`;
        const [row] = await tx`select 1 from supabase_migrations.schema_migrations where version = ${m.version}`;
        if (row) return false;
        await tx.unsafe(m.sql);
        await tx`insert into supabase_migrations.schema_migrations (version, name, statements) values (${m.version}, ${m.name}, ${[m.sql]})`;
        return true;
      });
      if (done) {
        applied++;
        console.log(`[migrate] applied ${m.version}_${m.name}`);
      }
    }
    console.log(`[migrate] ${applied} applied, ${migrations.length - applied} already there`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  // Jamais l'URL ni le mot de passe dans les journaux : seulement le code et le message de Postgres
  console.error(`[migrate] failed: ${err?.code ?? ""} ${err?.message ?? err}`);
  process.exit(1);
});
