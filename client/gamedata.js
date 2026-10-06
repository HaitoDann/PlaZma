// Consolidation des données de jeu (champions/sorts) extraites de la LCU en un
// seul fichier compact « champions-wiki.json » destiné au wiki d'ARCHI.
// Les descriptions sont nettoyées (HTML + marqueurs @…@ retirés) ; coût,
// cooldown et portée viennent des tableaux numériques résolus par niveau.
'use strict';

// Nettoie un texte de tooltip : retire les balises <…>, les marqueurs @…@ et
// %i:…% non résolus, normalise les espaces insécables.
function cleanText(t) {
  if (!t) return '';
  return String(t)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/@[^@]+@/g, '?')          // valeur non résolue → « ? »
    .replace(/%i:[^%]+%/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+\?/g, ' ?')
    .trim();
}

// Convertit un chemin d'asset LCU (/lol-game-data/assets/…) en URL CommunityDragon.
function cdragon(path) {
  if (!path) return '';
  const p = String(path).replace(/^\/lol-game-data\/assets\//i, '').toLowerCase();
  return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/' + p;
}

// Ne garde que les valeurs utiles d'un tableau par niveau (déduplique les répétitions).
function levels(arr) {
  if (!Array.isArray(arr)) return [];
  const a = arr.filter(x => x != null);
  if (!a.length) return [];
  const uniq = a.every(x => x === a[0]);
  return uniq ? [a[0]] : a;
}

// Extrait un champion détaillé (champion-<id>.json) en objet compact.
function champion(detail) {
  const tag = detail.championTagInfo || {};
  const tac = detail.tacticalInfo || {};
  const p = detail.passive || {};
  const spells = (detail.spells || []).map(s => ({
    key: (s.spellKey || '').toUpperCase(),
    name: s.name || '',
    icon: cdragon(s.abilityIconPath),
    desc: cleanText(s.description),
    cost: levels(s.costCoefficients),
    cooldown: levels(s.cooldownCoefficients),
    range: levels(s.range),
  }));
  return {
    id: detail.id,
    key: detail.alias || '',
    name: detail.name || '',
    title: detail.title || '',
    roles: detail.roles || [],
    tags: [tag.championTagPrimary, tag.championTagSecondary].filter(Boolean),
    difficulty: tac.difficulty || null,
    damageType: (tac.damageType || '').replace(/^k/, ''),  // kPhysical → Physical
    attackType: tac.attackType || '',
    lore: cleanText(detail.shortBio).slice(0, 600),
    passive: { name: p.name || '', icon: cdragon(p.abilityIconPath), desc: cleanText(p.description) },
    spells,
  };
}

// Construit l'objet wiki complet à partir du résumé + des détails par id.
// summary : champion-summary.json ; detailsById : { <id>: champion-<id>.json }.
function buildWiki(summary, detailsById, patch) {
  const champs = [];
  for (const c of (summary || [])) {
    if (!c || c.id <= 0) continue;                 // ignore « Aucun » (-1)
    const d = detailsById[c.id];
    if (d) champs.push(champion(d));
    else champs.push({                             // fallback si le détail manque
      id: c.id, key: c.alias || '', name: c.name || '', title: c.description || '',
      roles: c.roles || [], tags: [], difficulty: null, damageType: '', attackType: '',
      lore: '', passive: null, spells: [],
    });
  }
  champs.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return { patch: patch || '', generatedAt: new Date().toISOString(), count: champs.length, champions: champs };
}

module.exports = { buildWiki, champion, cleanText, cdragon, levels };
