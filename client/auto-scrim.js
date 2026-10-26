// ARCHI Link — import automatique des scrims
// -------------------------------------------
// Quand un scrim est au calendrier (Planning) et qu'une partie personnalisée
// est jouée pendant ce créneau, le replay .rofl correspondant est détecté,
// rattaché au bon créneau et ses stats sont poussées dans le CR de scrim —
// sans la moindre manipulation.
//
// Fonctionne entièrement avec le compte ARCHI du joueur (mêmes règles Firestore
// que le site) : lecture du planning, recherche/écriture du CR. Si le compte n'a
// pas l'accès « scrim » en édition (ou « planning » en lecture), la fonction se
// contente de le signaler et ne force rien. À n'activer idéalement que sur UN
// poste de l'équipe.
//
// Ne touche jamais au jeu : on ne lit que le .rofl (déjà sur le disque) et
// Firestore en HTTPS. Rien que Vanguard puisse considérer comme de la triche.
'use strict';
const { fireGet, fireQuery, firePatch } = require('./push');

const COLLECTION = 'plazma';
const SCRIMS_COL = 'plazma-scrims';
const LINK_TYPES = ['scrim', 'match'];
const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MIN_ROSTER_HITS = 4;             // nb de joueurs du roster d'un même camp pour reconnaître un scrim
const PRE_MIN = 25;                    // marge avant le début du créneau (min)
const POST_MIN = 240;                  // marge après (un bloc de scrims peut durer longtemps)

const _p2 = n => String(n).padStart(2, '0');

// ---- Semaine ISO + date d'un jour (identiques au site, PZ.stats) ----
function isoWeekOf(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + _p2(Math.ceil((((t - y1) / 86400000) + 1) / 7));
}
function slotDate(week, day) {
  const [y, w] = String(week || '').split('-W').map(Number); const di = DAY_NAMES.indexOf(day);
  if (!y || !w || di < 0) return '';
  const jan4 = new Date(Date.UTC(y, 0, 4)); const dow = jan4.getUTCDay() || 7;
  const d = new Date(jan4); d.setUTCDate(jan4.getUTCDate() - (dow - 1) + (w - 1) * 7 + di);
  return d.getUTCFullYear() + '-' + _p2(d.getUTCMonth() + 1) + '-' + _p2(d.getUTCDate());
}
const parseHM = t => (/^\d{1,2}:\d{2}$/.test(t || '') ? (+t.split(':')[0]) * 60 + (+t.split(':')[1]) : null);

// ---- Pseudos du roster (pour reconnaître le camp PlaZma dans un .rofl) ----
const norm = s => String(s || '').toLowerCase().replace(/\s/g, '');
async function loadHandles(cfg, extra) {
  const set = new Set();
  const add = h => { h = norm(h); if (h) { set.add(h); set.add(h.split('-')[0]); set.add(h.split('#')[0]); } };
  (extra || []).forEach(add);
  // 1) comptes op.gg (doc dashboard) — source la plus fiable (identifiants Riot).
  try {
    const dash = await fireGet(cfg, COLLECTION + '/dashboard');
    ((dash && dash.roster) || []).forEach(r => { if (r && r.opgg) add(r.opgg); });
  } catch (e) { /* accès dashboard non autorisé : on se rabat sur les noms du roster */ }
  // 2) noms du roster central (lecture publique).
  try {
    const roster = await fireGet(cfg, COLLECTION + '/roster');
    if (roster) Object.keys(roster).forEach(k => { const v = roster[k]; if (v && v.name) add(v.name); });
  } catch (e) {}
  return set;
}

// Camp (blue/red) qui compte le plus de joueurs du roster, et ce compte.
function detectScrimSide(players, handles) {
  const hits = { blue: 0, red: 0 };
  players.forEach(p => {
    const full = norm(p.name + '-' + p.tag), bare = norm(p.name);
    if (handles.has(full) || handles.has(bare)) hits[p.team]++;
  });
  const side = hits.blue >= hits.red ? 'blue' : 'red';
  return { side, count: hits[side] };
}

// ---- Créneaux « scrim/match » des semaines autour de maintenant ----
async function loadScrimSlots(cfg, now) {
  const weeks = [isoWeekOf(new Date(now - 7 * 864e5)), isoWeekOf(new Date(now)), isoWeekOf(new Date(now + 7 * 864e5))];
  const slots = [];
  for (const w of weeks) {
    let doc; try { doc = await fireGet(cfg, COLLECTION + '/schedule-' + w); } catch (e) { continue; }
    const sched = (doc && doc.schedule) || {};
    DAY_NAMES.forEach(day => (sched[day] || []).forEach((sl, idx) => {
      if (!sl || LINK_TYPES.indexOf(sl.type) === -1) return;
      const date = slotDate(w, day); if (!date) return;
      const startM = parseHM(sl.start); const endM = parseHM(sl.end);
      const base = new Date(date + 'T00:00').getTime();
      const start = base + (startM != null ? startM : 0) * 60000;
      let end = base + (endM != null ? endM : (startM != null ? startM + 180 : 1439)) * 60000;
      if (end < start) end += 864e5;                 // créneau à cheval sur minuit
      slots.push({ id: sl.id || (w + '#' + day + '#' + idx), week: w, day, date, note: sl.note || '',
        winStart: start - PRE_MIN * 60000, winEnd: end + POST_MIN * 60000 });
    }));
  }
  return slots;
}
function matchSlot(slots, atMs) {
  // Le plus proche créneau dont la fenêtre contient l'instant de la partie.
  let best = null, bestD = Infinity;
  slots.forEach(s => {
    if (atMs < s.winStart || atMs > s.winEnd) return;
    const d = Math.abs(atMs - (s.winStart + PRE_MIN * 60000));
    if (d < bestD) { bestD = d; best = s; }
  });
  return best;
}

// ---- CR de scrim : recherche (par créneau) ou création déterministe ----
async function findOrCreateScrim(cfg, slot) {
  let hits = [];
  try { hits = await fireQuery(cfg, SCRIMS_COL, 'slotId', slot.id); } catch (e) {}
  if (hits && hits.length) { const d = hits[0]; return { id: d.id, data: d }; }
  // Id déterministe : tous les postes convergent vers le même document (pas de doublon).
  const id = 'scrim-auto-' + String(slot.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  let data = null; try { data = await fireGet(cfg, SCRIMS_COL + '/' + id); } catch (e) {}
  return { id, data, isNew: !data };
}

// Signature stable d'une partie (indépendante du camp) pour le dédoublonnage.
function gameSig(parsed) {
  return (parsed.durationSec || 0) + ':' + parsed.players.map(p => p.champ).sort().join(',');
}

// ---- Traitement d'un replay : détecte, rattache, remplit ----
// replay = { file, mtimeMs, parsed, tl? } (tl : résumé de timeline, cf. timeline.js). Renvoie { file, outcome } :
//   not-scrim | no-slot | dup | full | attached
async function processReplay(cfg, replay, ctx) {
  const { handles, slots, log } = ctx;
  const parsed = replay.parsed;
  if (!parsed || !Array.isArray(parsed.players) || parsed.players.length < 6) return { file: replay.file, outcome: 'not-scrim' };
  const det = detectScrimSide(parsed.players, handles);
  if (det.count < MIN_ROSTER_HITS) return { file: replay.file, outcome: 'not-scrim' };   // pas un scrim PlaZma
  const slot = matchSlot(slots, replay.mtimeMs);
  if (!slot) return { file: replay.file, outcome: 'no-slot' };   // aucun créneau à cette heure (réessai plus tard)

  const ref = await findOrCreateScrim(cfg, slot);
  const data = ref.data || {};
  const sig = gameSig(parsed);
  // Déjà importée ? (même signature ou même fichier dans une des games)
  for (let g = 1; g <= 5; g++) {
    const st = data['g' + g + '_stats'];
    if (st && (st.sig === sig || (st.file && st.file === replay.file))) {
      // Game déjà importée sans timeline : on la complète dès qu'elle est disponible.
      if (!st.tl && replay.tl) {
        const f = {}; f['g' + g + '_stats'] = Object.assign({}, st, { tl: replay.tl });
        await firePatch(cfg, SCRIMS_COL + '/' + ref.id, f);
        log('🕒→☁ scrim auto : timeline ajoutée à la Game ' + g + ' (' + replay.file + ').');
      }
      return { file: replay.file, outcome: 'dup' };
    }
  }
  // Premier emplacement libre.
  let gk = null;
  for (let g = 1; g <= 5; g++) { if (!data['g' + g + '_stats']) { gk = 'g' + g; break; } }
  if (!gk) { log('⚠ CR du scrim déjà complet (5 games) — ' + replay.file + ' non ajouté.'); return { file: replay.file, outcome: 'full' }; }

  const side = det.side;
  const win = (parsed.players.find(p => p.team === side) || {}).win || false;
  const st = { durationSec: parsed.durationSec, patch: parsed.patch, players: parsed.players,
    side, win, file: replay.file, sig, auto: true, v: 2 };
  if (replay.tl) st.tl = replay.tl;

  // Score recalculé à partir des games remplies (y compris la nouvelle).
  let w = 0, l = 0;
  for (let g = 1; g <= 5; g++) { const s = (gk === 'g' + g) ? st : data['g' + g + '_stats']; if (s) { if (s.win) w++; else l++; } }

  const fields = {};
  fields[gk + '_stats'] = st;
  fields[gk + '_result'] = win ? 'V' : 'D';
  fields.s_plazma = String(w); fields.s_adv = String(l);
  fields.slotId = slot.id; fields.slotWeek = slot.week;
  fields._savedAt = new Date();
  if (!data.m_date) fields.m_date = slot.date;
  if (!data.m_adv) fields.m_adv = slot.note || 'Scrim';

  await firePatch(cfg, SCRIMS_COL + '/' + ref.id, fields);
  log('🎮→☁ scrim auto : ' + replay.file + ' ajouté en ' + gk.toUpperCase().replace('G', 'Game ') +
    ' (' + (win ? 'V' : 'D') + ') au CR « ' + (data.m_adv || slot.note || slot.date) + ' ».');
  return { file: replay.file, outcome: 'attached' };
}

// Point d'entrée : traite une liste de replays parsés.
// opts = { cfg, replays:[{file,mtimeMs,parsed}], riotId, log }
// Renvoie [{ file, outcome }] pour chaque replay traité (pour le suivi côté client).
async function run(opts) {
  const { cfg, replays, log } = opts;
  if (!replays || !replays.length) return [];
  const f = cfg.features || {};
  if (!f.autoScrim) return [];
  if (!(cfg.auth && cfg.auth.username && cfg.auth.password)) return [];
  const now = Date.now();
  let handles, slots;
  try { handles = await loadHandles(cfg, opts.riotId ? [opts.riotId] : []); }
  catch (e) { log('⚠ scrim auto : lecture du roster impossible — ' + e.message); return []; }
  try { slots = await loadScrimSlots(cfg, now); }
  catch (e) {
    if (/HTTP 403|PERMISSION/.test(e.message)) log('⚠ scrim auto : ton compte ARCHI n\'a pas accès au Planning — demande l\'accès « planning » (lecture) à un admin.');
    else log('⚠ scrim auto : lecture du Planning impossible — ' + e.message);
    return [];
  }
  if (!slots.length) return [];                   // aucun scrim planifié : rien à faire
  const ctx = { handles, slots, log };
  const results = [];
  for (const r of replays) {
    try { results.push(await processReplay(cfg, r, ctx)); }
    catch (e) {
      if (/HTTP 403|PERMISSION/.test(e.message)) { log('⚠ scrim auto : ton compte ARCHI ne peut pas écrire les CR de scrim (accès « scrim » en édition requis) — import désactivé pour cette session.'); break; }
      log('⚠ scrim auto : ' + r.file + ' — ' + e.message);
    }
  }
  return results;
}

module.exports = { run, isoWeekOf, slotDate, detectScrimSide, matchSlot, gameSig };
