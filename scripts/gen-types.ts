import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("Set DATABASE_URL to the migration database URL (use an SSH tunnel; see docs/deploy.md).");
  process.exit(1);
}

const cli = fileURLToPath(new URL("../node_modules/supabase/dist/supabase.js", import.meta.url));
const result = spawnSync(
  process.execPath,
  [cli, "gen", "types", "typescript", "--schema", "public", `--remote=${databaseUrl}`],
  { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
);

if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
writeFileSync(resolve("src/lib/supabase/database.types.ts"), result.stdout);
console.log("Updated src/lib/supabase/database.types.ts from DATABASE_URL.");
