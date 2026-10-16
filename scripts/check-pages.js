#!/usr/bin/env node
// Vérifications statiques rapides des pages (lancées en CI) :
//   - chaque script inline et chaque assets/*.js est syntaxiquement valide ;
//   - chaque page applicative déclare la Content-Security-Policy.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const errors = [];
const syntax = (code, where) => {
  try { new vm.Script(code, { filename: where }); }
  catch (e) { errors.push(`${where} : ${e.message}`); }
};

for (const f of fs.readdirSync(path.join(root, 'assets')).filter(f => f.endsWith('.js'))) {
  syntax(fs.readFileSync(path.join(root, 'assets', f), 'utf8'), `assets/${f}`);
}

for (const f of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, f), 'utf8');
  const isRedirect = /http-equiv="refresh"/i.test(html);
  if (!isRedirect && !/http-equiv="Content-Security-Policy"/i.test(html)) errors.push(`${f} : CSP manquante`);
  let i = 0;
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/type="(module|application\/json)"/i.test(m[1])) continue;
    syntax(m[2], `${f} (script inline #${++i})`);
  }
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('OK — scripts valides et CSP présente sur toutes les pages.');
