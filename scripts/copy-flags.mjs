// Copie les drapeaux SVG de flag-icons (MIT, docs/sources.md) dans public/flags/.
// Lancé par postinstall : le composant Flag lit /flags/{code}.svg.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("flag-icons/package.json"));
const src = join(pkg, "flags", "4x3");
const dest = join(process.cwd(), "public", "flags");
if (!existsSync(src)) {
  console.warn("flag-icons introuvable, drapeaux non copiés");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
cpSync(join(pkg, "LICENSE"), join(dest, "LICENSE"));
console.log("Drapeaux copiés dans public/flags");
