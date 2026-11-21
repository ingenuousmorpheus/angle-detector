// Fails the release build if dist/ contains anything that must not ship:
// a Google API key, the Gemini client/endpoint, or developer-only hooks.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist';
const rules = [
  [/AIza[0-9A-Za-z_\-]{35}/, 'Google API key'],
  [/generativelanguage\.googleapis\.com/, 'Gemini endpoint'],
  [/@google\/genai|GoogleGenAI/, 'Gemini client library'],
  [/\.get\(\s*["']photo["']\s*\)/, '?photo= developer hook'],
];
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); });
walk(root);
let bad = 0;
for (const f of files.filter((f) => /\.(js|html|css|json|map)$/.test(f))) {
  const s = readFileSync(f, 'utf8');
  for (const [re, what] of rules) if (re.test(s)) { console.error(`FAIL ${what} found in ${f}`); bad++; }
}
if (bad) process.exit(1);
console.log(`Release bundle check passed (${files.length} files scanned in ${root}).`);
