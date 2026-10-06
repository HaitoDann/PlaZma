#!/usr/bin/env node
/*
 * ARCHI — client local (premier jet / validation)
 * -----------------------------------------------
 * Fait 3 choses, en local, sans aucune clé Riot :
 *   1) lit le rang SoloQ du compte connecté (API locale du client League, « LCU ») ;
 *   2) parse automatiquement les replays .rofl du dossier Replays ;
 *   3) tient un historique du rang SoloQ dans le temps.
 *
 * CE PREMIER JET N'ENVOIE RIEN À ARCHI. Il écrit tout dans ./archi-data/ et
 * l'affiche, pour qu'on valide sur un vrai PC que les données lues sont bonnes
 * avant de brancher l'envoi vers ARCHI (Firestore).
 *
 * Ne touche jamais au jeu : aucune injection, aucune lecture mémoire, aucun
 * overlay. Rien que Vanguard puisse considérer comme de la triche.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { parseRofl } = require('./rofl');
const { pushStats } = require('./push');

// En .exe (pkg), les fichiers (config.json, archi-data) sont à côté de l'exécutable ;
// en Node classique, à côté du script.
const HERE = process.pkg ? path.dirname(process.execPath) : __dirname;
const OUT = path.join(HERE, 'archi-data');
const REPLAYS_OUT = path.join(OUT, 'replays');
const HISTORY_FILE = path.join(OUT, 'soloq-history.json');
const RANK_FILE = path.join(OUT, 'rank.json');
const INDEX_FILE = path.join(OUT, 'replays-index.json');

// ---- Config (client/config.json, sinon valeurs par défaut Windows) ----
function loadConfig() {
  const defaults = {
    lockfile: 'C:\\Riot Games\\League of Legends\\lockfile',
    replaysDir: path.join(os.homedir(), 'Documents', 'League of Legends', 'Replays'),
    pollMinutes: 5,
    push: { enabled: false, username: '', password: '', playerId: '' },
  };
  const expand = s => typeof s === 'string'
    ? s.replace(/%([^%]+)%/g, (_, v) => process.env[v] || _)
    : s;
  const cfgPath = path.join(HERE, 'config.json');
  let raw;
  try { raw = fs.readFileSync(cfgPath, 'utf8'); }
  catch (e) { defaults._configFound = false; return defaults; }
  let c;
  try { c = JSON.parse(raw); }
  catch (e) { defaults._configFound = true; defaults._configError = e.message; return defaults; }
  const merged = Object.assign(defaults, c);
  merged._configFound = true;
  merged.lockfile = expand(merged.lockfile);
  merged.replaysDir = expand(merged.replaysDir);
  return merged;
}
const CFG = loadConfig();

function log(...a) { console.log(new Date().toLocaleTimeString('fr-FR'), '·', ...a); }
function ensureDirs() { for (const d of [OUT, REPLAYS_OUT]) fs.mkdirSync(d, { recursive: true }); }
function readJson(f, fallback) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fallback; } }
function writeJson(f, v) { fs.writeFileSync(f, JSON.stringify(v, null, 2)); }

// ---- LCU : lecture du lockfile + requêtes locales ----
function readLockfile() {
  let raw;
  try { raw = fs.readFileSync(CFG.lockfile, 'utf8'); }
  catch (e) { return null; }                     // client League fermé
  const p = raw.trim().split(':');               // name:pid:port:password:protocol
  if (p.length < 5) return null;
  return { port: p[2], password: p[3] };
}

function lcuGet(lock, endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '127.0.0.1', port: lock.port, path: endpoint, method: 'GET',
      headers: { Authorization: 'Basic ' + Buffer.from('riot:' + lock.password).toString('base64') },
      rejectUnauthorized: false,                  // le client utilise un certificat auto-signé local
      timeout: 8000,
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('réponse illisible ' + endpoint)); }
        } else reject(new Error('HTTP ' + res.statusCode + ' sur ' + endpoint));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout ' + endpoint)));
    req.end();
  });
}

// ---- Rang SoloQ + identité ----
async function fetchRank(lock) {
  const me = await lcuGet(lock, '/lol-summoner/v1/current-summoner');
  const riotId = (me.gameName && me.tagLine) ? `${me.gameName}#${me.tagLine}` : (me.displayName || '?');
  let solo = null;
  try {
    const ranked = await lcuGet(lock, '/lol-ranked/v1/current-ranked-stats');
    const q = (ranked.queueMap && ranked.queueMap.RANKED_SOLO_5x5) || {};
    const wins = +q.wins || 0, losses = +q.losses || 0, tot = wins + losses;
    solo = {
      tier: q.tier || 'UNRANKED',
      division: q.division && q.division !== 'NA' ? q.division : '',
      lp: +q.leaguePoints || 0,
      wins, losses,
      wr: tot ? Math.round(wins / tot * 100) : null,
      provisional: !!q.isProvisional,
    };
  } catch (e) { log('⚠ rang indisponible :', e.message); }
  return { riotId, puuid: me.puuid || '', summonerId: me.summonerId || '', solo, updatedAt: new Date().toISOString() };
}

// Ajoute un point d'historique seulement si le rang a changé (ou premier point).
function appendHistory(rank) {
  if (!rank.solo) return;
  const hist = readJson(HISTORY_FILE, []);
  const last = hist[hist.length - 1];
  const s = rank.solo;
  const changed = !last || last.tier !== s.tier || last.division !== s.division ||
    last.lp !== s.lp || last.wins !== s.wins || last.losses !== s.losses;
  if (!changed) return;
  hist.push({ ts: rank.updatedAt, tier: s.tier, division: s.division, lp: s.lp, wins: s.wins, losses: s.losses });
  writeJson(HISTORY_FILE, hist);
  log('↗ historique SoloQ : nouveau point', rankLabel(s), '(' + hist.length + ' au total)');
}
function rankLabel(s) {
  if (!s || s.tier === 'UNRANKED') return 'Non classé';
  const fr = { IRON: 'Fer', BRONZE: 'Bronze', SILVER: 'Argent', GOLD: 'Or', PLATINUM: 'Platine', EMERALD: 'Émeraude', DIAMOND: 'Diamant', MASTER: 'Master', GRANDMASTER: 'Grand Maître', CHALLENGER: 'Challenger' };
  return `${fr[s.tier] || s.tier}${s.division ? ' ' + s.division : ''} · ${s.lp} LP` + (s.wr != null ? ` · ${s.wr}% WR` : '');
}

// ---- Historique de parties classées (bonus, best-effort) ----
async function fetchRecentRanked(lock) {
  try {
    const mh = await lcuGet(lock, '/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=20');
    const games = (mh && mh.games && mh.games.games) || [];
    return games.filter(g => g.queueId === 420).slice(0, 10).map(g => {
      const me = (g.participants && g.participants[0]) || {};
      const st = me.stats || {};
      return {
        gameId: g.gameId, ts: g.gameCreation, durationSec: g.gameDuration,
        champ: me.championId, win: !!st.win,
        k: st.kills || 0, d: st.deaths || 0, a: st.assists || 0,
      };
    });
  } catch (e) { return null; }
}

// ---- Replays .rofl ----
function processReplay(file) {
  const index = readJson(INDEX_FILE, {});
  if (index[file]) return;                        // déjà traité
  const full = path.join(CFG.replaysDir, file);
  let stat; try { stat = fs.statSync(full); } catch (e) { return; }
  if (stat.size < 1024) return;                   // fichier encore en cours d'écriture
  let parsed;
  try { parsed = parseRofl(fs.readFileSync(full)); }
  catch (e) { log('⚠ .rofl illisible', file, '—', e.message); index[file] = { error: e.message, at: Date.now() }; writeJson(INDEX_FILE, index); return; }
  const out = { file, parsedAt: new Date().toISOString(), durationSec: parsed.durationSec, patch: parsed.patch, players: parsed.players };
  writeJson(path.join(REPLAYS_OUT, file.replace(/\.rofl$/i, '') + '.json'), out);
  index[file] = { ok: true, at: Date.now(), players: parsed.players.length };
  writeJson(INDEX_FILE, index);
  const names = parsed.players.map(p => p.champ).join(', ');
  log('🎮 replay parsé :', file, '· durée', Math.round(parsed.durationSec / 60) + 'min ·', names);
}
function scanReplays() {
  let files; try { files = fs.readdirSync(CFG.replaysDir).filter(f => /\.rofl$/i.test(f)); }
  catch (e) { return; }
  files.forEach(processReplay);
}
function watchReplays() {
  try {
    fs.watch(CFG.replaysDir, (ev, file) => { if (file && /\.rofl$/i.test(file)) setTimeout(() => processReplay(file), 2500); });
    log('👀 surveillance du dossier Replays :', CFG.replaysDir);
  } catch (e) { log('⚠ dossier Replays introuvable (', CFG.replaysDir, ') — réessai au prochain cycle'); }
}

// ---- Boucle principale ----
let warnedClosed = false;
async function cycle() {
  const lock = readLockfile();
  if (!lock) {
    if (!warnedClosed) { log('⏳ client League fermé — en attente (ouvre le client pour lire le rang).'); warnedClosed = true; }
    scanReplays();                                // les .rofl se lisent même client fermé
    return;
  }
  warnedClosed = false;
  try {
    const rank = await fetchRank(lock);
    writeJson(RANK_FILE, rank);
    appendHistory(rank);
    log('👤', rank.riotId, '—', rankLabel(rank.solo));
    const recent = await fetchRecentRanked(lock);
    if (recent) writeJson(path.join(OUT, 'recent-ranked.json'), recent);
    await maybePush(rank, recent);
    await dumpGameData(lock);
  } catch (e) { log('⚠ lecture LCU impossible :', e.message); }
  scanReplays();
}

let _gameDataDone = false;
// Extrait les données de champions/sorts depuis le client League (LCU, local).
// Source brute, sans intermédiaire ni clé, alignée sur le patch installé.
async function dumpGameData(lock) {
  if (_gameDataDone) return;
  const dir = path.join(OUT, 'gamedata');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  let summary;
  try { summary = await lcuGet(lock, '/lol-game-data/assets/v1/champion-summary.json'); }
  catch (e) { log('⚠ données de jeu indisponibles :', e.message); return; }
  writeJson(path.join(dir, 'champion-summary.json'), summary);
  const ids = (summary || []).map(c => c.id).filter(id => id && id > 0);
  // Échantillons variés (par id numérique) pour voir toutes les formes de sorts.
  const samples = [266, 99, 222, 412, 64].filter(id => ids.includes(id));
  for (const id of samples) {
    try { const c = await lcuGet(lock, '/lol-game-data/assets/v1/champions/' + id + '.json');
      writeJson(path.join(dir, 'champion-' + id + '.json'), c); }
    catch (e) { log('⚠ champion', id, ':', e.message); }
  }
  _gameDataDone = true;
  log('📘 données de jeu extraites (' + ids.length + ' champions) → archi-data/gamedata/ · échantillons :', samples.join(', '));
  log('   Envoie-moi champion-summary.json + un champion-<id>.json pour que je bâtisse le wiki.');
}

async function maybePush(rank, recent) {
  const p = CFG.push || {};
  if (!p.enabled) return;
  if (!p.username || !p.password || !p.playerId) { log('⚠ push activé mais username/password/playerId manquant dans config.json'); return; }
  if (!rank || !rank.solo) return;
  try {
    await pushStats(p, {
      riotId: rank.riotId, puuid: rank.puuid,
      solo: rank.solo,
      history: readJson(HISTORY_FILE, []).slice(-60),
      recent: (recent || []).slice(0, 10),
      updatedAt: rank.updatedAt,
    });
    log('☁ envoyé à ARCHI (plazma-stats/' + p.playerId + ')');
  } catch (e) { log('⚠ envoi ARCHI impossible :', e.message); }
}

function main() {
  ensureDirs();
  console.log('========================================================');
  console.log(' ARCHI — client local');
  console.log(' Sorties locales :', OUT);
  console.log('========================================================');
  log('Lockfile attendu :', CFG.lockfile);
  log('Dossier Replays  :', CFG.replaysDir);
  if (CFG._configError) log('❌ config.json illisible (erreur JSON) :', CFG._configError, '— valeurs par défaut utilisées, PUSH DÉSACTIVÉ. Vérifie le fichier (virgule en trop ?).');
  else if (!CFG._configFound) log('ℹ config.json absent — valeurs par défaut, push désactivé. Crée-le depuis config.example.json pour envoyer à ARCHI.');
  const p = CFG.push || {};
  if (p.enabled) log('☁ Push ARCHI : ACTIVÉ (joueur «', p.playerId || '?', '», compte «', p.username || '?', '»).');
  else log('☁ Push ARCHI : désactivé (push.enabled = false dans config.json).');
  watchReplays();
  cycle();
  setInterval(cycle, Math.max(1, +CFG.pollMinutes || 5) * 60 * 1000);
}
main();
