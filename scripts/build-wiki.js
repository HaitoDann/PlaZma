#!/usr/bin/env node
/* ============================================================
   ARCHI — Générateur de l'encyclopédie (wiki perf)
   Lit les notes Markdown d'un vault Obsidian (docs/vault) et
   produit assets/wiki-data.js consommé par plazma-wiki-perf.html.

   Le résultat est 100% statique : aucune lecture de .md côté
   navigateur (fonctionne en local file:// comme sur GitHub Pages).

   Prérequis : le paquet `marked` doit être résoluble.
     npm i marked   (ou NODE_PATH vers un node_modules qui le contient)
   Usage :
     node scripts/build-wiki.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const VAULT = path.join(ROOT, 'docs', 'vault');
const OUT = path.join(ROOT, 'assets', 'wiki-data.js');

// Emoji par catégorie (préfixe de dossier NN_)
const CAT_ICONS = {
  '01': '🧠', '02': '⚔️', '03': '📊', '04': '🗺️', '05': '🧩', '06': '🌙',
};

marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });

// ---- Parcours récursif du vault ----
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function prettify(s) {
  return s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}
function catLabel(folder) {
  return prettify(folder.replace(/^\d+_/, '').replace(/_&_/g, ' & '));
}
function catOrder(folder) {
  const m = folder.match(/^(\d+)_/);
  return m ? m[1] : '99';
}
// clé de correspondance pour les wikilinks (insensible casse/accents)
function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return { date: null, updated: null, body: raw };
  const block = m[1];
  const date    = (block.match(/^date:\s*(\S+)/m)    || [])[1] || null;
  const updated = (block.match(/^updated:\s*(\S+)/m) || [])[1] || null;
  return { date, updated, body: raw.slice(m[0].length) };
}

// ---- Découverte des articles ----
const files = walk(VAULT).sort();
const articles = [];
const byKey = {};   // clé normalisée -> id (fileBase)

for (const file of files) {
  const rel = path.relative(VAULT, file);            // 01_x/Sous/Note.md
  const parts = rel.split(path.sep);
  const folder = parts[0];
  const sub = parts.length > 2 ? prettify(parts[parts.length - 2]) : null;
  const fileBase = path.basename(file, '.md');       // "Flow_et_Concentration"
  const raw = fs.readFileSync(file, 'utf8');
  const { date, updated, body } = parseFrontmatter(raw);
  const h1 = body.match(/^#\s+(.+)$/m);
  const title = h1 ? h1[1].trim() : prettify(fileBase);

  const art = {
    id: fileBase,
    title,
    cat: catOrder(folder),
    catName: catLabel(folder),
    catIcon: CAT_ICONS[catOrder(folder)] || '📄',
    sub,
    raw: body,
    date,
    updated,
  };
  articles.push(art);
  byKey[norm(fileBase)] = fileBase;
  byKey[norm(title)] = byKey[norm(title)] || fileBase;
}

// ---- Résolution d'un wikilink -> id ou null ----
function resolveTarget(target) {
  let t = target.split('|')[0].trim();
  t = t.replace(/#.*$/, '');                 // enlève ancre éventuelle
  t = t.replace(/\\/g, '/');
  const base = t.split('/').filter(Boolean).pop() || t;   // dernier segment
  return byKey[norm(base)] || null;
}

// ---- Conversion Markdown -> HTML (wikilinks pré-traités) ----
function convert(art) {
  // Remplace [[Cible|Alias]] / [[Cible]] par une ancre HTML (marked la conserve).
  const md = art.raw.replace(/\[\[([^\]]+)\]\]/g, (m, inner) => {
    const [tgt, alias] = inner.split('|');
    const label = (alias || tgt.split('/').pop() || tgt).replace(/_/g, ' ').trim();
    const id = resolveTarget(inner);
    if (id) return `<a class="wl" href="#${encodeURIComponent(id)}" data-id="${escAttr(id)}">${escHtml(label)}</a>`;
    return `<span class="wl wl-missing" title="Note absente du vault">${escHtml(label)}</span>`;
  });
  const html = marked.parse(md);
  return html;
}
function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

// ---- Construction de la sortie ----
const outArticles = articles.map(a => {
  const html = convert(a);
  const plain = stripHtml(html);
  return {
    id: a.id,
    title: a.title,
    cat: a.cat,
    catName: a.catName,
    catIcon: a.catIcon,
    sub: a.sub,
    html,
    excerpt: plain.slice(0, 160),
    words: plain ? plain.split(' ').length : 0,
    stub: plain.length < 90,
    text: plain.toLowerCase(),
    date: a.date,
    updated: a.updated,
  };
});

// Catégories ordonnées
const catMap = new Map();
for (const a of outArticles) {
  if (!catMap.has(a.cat)) catMap.set(a.cat, { id: a.cat, name: a.catName, icon: a.catIcon, count: 0 });
  catMap.get(a.cat).count++;
}
const categories = [...catMap.values()].sort((x, y) => x.id.localeCompare(y.id));

// Tri des articles : par catégorie puis titre (INDEX en tête d'un sous-groupe)
outArticles.sort((x, y) =>
  x.cat.localeCompare(y.cat) ||
  (x.sub || '').localeCompare(y.sub || '') ||
  (x.id === 'INDEX' ? -1 : y.id === 'INDEX' ? 1 : 0) ||
  x.title.localeCompare(y.title, 'fr'));

const payload = {
  generatedAt: new Date().toISOString(),
  categories,
  articles: outArticles,
};

const banner = '/* Généré par scripts/build-wiki.js — NE PAS ÉDITER À LA MAIN. */\n';
fs.writeFileSync(OUT, banner + 'window.PZ_WIKI = ' + JSON.stringify(payload) + ';\n');

console.log(`✓ ${outArticles.length} articles, ${categories.length} catégories → ${path.relative(ROOT, OUT)}`);
const missing = new Set();
articles.forEach(a => (a.raw.match(/\[\[([^\]]+)\]\]/g) || []).forEach(w => {
  const inner = w.slice(2, -2);
  if (!resolveTarget(inner)) missing.add(inner.split('|')[0].trim());
}));
if (missing.size) console.log('  Liens vers des notes absentes :', [...missing].join(', '));
