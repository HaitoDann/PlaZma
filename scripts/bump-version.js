#!/usr/bin/env node
// Met à jour la version d'ARCHI partout d'un coup :
//   - VERSION dans assets/plazma.js (badge de la nav)
//   - les paramètres ?v=X.Y.Z des ressources partagées dans chaque page HTML
//     (force le rechargement du cache navigateur).
// Usage : node scripts/bump-version.js 3.27.0
//         node scripts/bump-version.js --check   (vérifie que tout est aligné)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const JS = path.join(root, 'assets/plazma.js');
const VERSION_RE = /(const VERSION\s*=\s*')([^']+)(')/;
const PARAM_RE = /(\.(?:css|js)\?v=)(\d+\.\d+\.\d+)/g;

const pages = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const current = (fs.readFileSync(JS, 'utf8').match(VERSION_RE) || [])[2];
const arg = process.argv[2];

if (!arg || arg === '--check') {
  const bad = [];
  for (const f of pages) {
    for (const m of fs.readFileSync(path.join(root, f), 'utf8').matchAll(PARAM_RE)) {
      if (m[2] !== current) bad.push(`${f} : ?v=${m[2]}`);
    }
  }
  if (bad.length) {
    console.error(`Version attendue ${current}, trouvé :\n  ` + bad.join('\n  '));
    process.exit(1);
  }
  console.log(`OK — toutes les pages référencent la version ${current}.`);
  process.exit(0);
}

if (!/^\d+\.\d+\.\d+$/.test(arg)) { console.error('Version invalide (attendu X.Y.Z)'); process.exit(1); }
fs.writeFileSync(JS, fs.readFileSync(JS, 'utf8').replace(VERSION_RE, `$1${arg}$3`));
let n = 0;
for (const f of pages) {
  const p = path.join(root, f);
  const src = fs.readFileSync(p, 'utf8');
  const out = src.replace(PARAM_RE, (_, a) => { n++; return a + arg; });
  if (out !== src) fs.writeFileSync(p, out);
}
console.log(`${current} → ${arg} (${n} références mises à jour).`);
