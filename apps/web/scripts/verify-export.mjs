// Verifies the static export in ./out: expected routes exist and no secrets are present.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT = "out";
const routes = ["", "sign-in", "forms", "admin", "maintenance", "maintenance/settings"];
const files = ["404.html", "manifest.webmanifest", "sw.js", "icons/icon-192.png", "icons/icon-512.png"];
const secretPatterns = [
  [/service_role/i, "service_role reference"],
  [/sb_secret_[A-Za-z0-9_-]+/, "Supabase secret key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/"private_key"\s*:/, "Google service-account key"],
  [/refresh_token/i, "refresh_token reference"],
  [/client_secret/i, "client_secret reference"],
  [/smtp[_-]?(pass|password)/i, "SMTP credential reference"],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "JWT-like token"],
];

const problems = [];
if (!existsSync(OUT)) { console.error("out/ not found. Run `npm run build` first."); process.exit(1); }
for (const r of routes) {
  const p = join(OUT, r, "index.html");
  if (!existsSync(p)) problems.push(`missing route file: ${p}`);
}
for (const f of files) if (!existsSync(join(OUT, f))) problems.push(`missing file: ${join(OUT, f)}`);

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const textExt = /\.(html|js|css|json|txt|webmanifest|map)$/;
let scanned = 0;
for (const f of walk(OUT)) {
  if (!textExt.test(f)) continue;
  scanned++;
  const text = readFileSync(f, "utf8");
  for (const [re, label] of secretPatterns) if (re.test(text)) problems.push(`${label} in ${f}`);
}

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
if (base) {
  const home = readFileSync(join(OUT, "index.html"), "utf8");
  if (!home.includes(`${base}/_next/`)) problems.push(`assets are not prefixed with base path ${base}`);
}

if (problems.length) { console.error("Export verification FAILED:\n- " + problems.join("\n- ")); process.exit(1); }
console.log(`Export verification passed: ${routes.length} routes, ${scanned} text files scanned, no secrets found.`);