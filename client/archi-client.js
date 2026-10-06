#!/usr/bin/env node
/*
 * ARCHI Link — client local d'ARCHI
 * ---------------------------------
 * En local, sans aucune clé Riot :
 *   1) lit le rang SoloQ (API locale du client League, « LCU ») ;
 *   2) parse les replays .rofl ; 3) tient l'historique SoloQ ;
 *   4) extrait les données de champions pour le wiki.
 *
 * Le joueur choisit ce qu'il partage via la fenêtre de configuration
 * (lancer avec --setup). Chaque option est optionnelle.
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
const { startServer } = require('./ui');
const tray = require('./tray');
const { exec, execFile } = require('child_process');
const APP_NAME = 'ARCHI Link';

// En .exe (pkg), les fichiers (config.json, archi-data) sont à côté de l'exécutable ;
// en Node classique, à côté du script.
const HERE = process.pkg ? path.dirname(process.execPath) : __dirname;
const OUT = path.join(HERE, 'archi-data');
const REPLAYS_OUT = path.join(OUT, 'replays');
const HISTORY_FILE = path.join(OUT, 'soloq-history.json');
const RANK_FILE = path.join(OUT, 'rank.json');
const INDEX_FILE = path.join(OUT, 'replays-index.json');
const LOG_FILE = path.join(OUT, 'log.txt');

// ---- Config (client/config.json, sinon valeurs par défaut Windows) ----
function loadConfig() {
  const defaults = {
    lockfile: 'C:\\Riot Games\\League of Legends\\lockfile',
    replaysDir: path.join(os.homedir(), 'Documents', 'League of Legends', 'Replays'),
    pollMinutes: 5,
    auth: { username: '', password: '' },
    playerId: '',
    features: { rank: true, soloq: true, wiki: false },
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
  const merged = Object.assign({}, defaults, c);
  // Migration de l'ancien bloc "push" vers auth/features.
  if (c.push && !c.auth) {
    merged.auth = { username: c.push.username || '', password: c.push.password || '' };
    merged.playerId = c.push.playerId || '';
    merged.features = { rank: !!c.push.enabled, soloq: !!c.push.enabled, wiki: false };
  }
  merged.auth = Object.assign({ username: '', password: '' }, merged.auth);
  merged.features = Object.assign({ rank: true, soloq: true, wiki: false }, merged.features);
  delete merged.push;
  merged._configFound = true;
  merged.lockfile = expand(merged.lockfile);
  merged.replaysDir = expand(merged.replaysDir);
  return merged;
}
let CFG = loadConfig();
function reloadConfig() { CFG = loadConfig(); log('⟳ configuration rechargée.'); logFeatures(); }

const LOG = [];                                   // dernières lignes (page d'état)
function log(...a) {
  const line = new Date().toLocaleTimeString('fr-FR') + ' · ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
  console.log(line);
  LOG.push(line); if (LOG.length > 80) LOG.shift();
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (e) {}
}

// État courant (exposé à la page d'état).
const STATE = { leagueOpen: false, riotId: '', rankLabel: '', lastPush: '', lastPushOk: false, autostart: null };
function getStatus() {
  const f = CFG.features || {}; const on = [];
  if (f.rank) on.push('rang'); if (f.soloq) on.push('SoloQ/.rofl'); if (f.wiki) on.push('wiki');
  return { appName: APP_NAME, leagueOpen: STATE.leagueOpen, riotId: STATE.riotId, rankLabel: STATE.rankLabel,
    lastPush: STATE.lastPush, lastPushOk: STATE.lastPushOk, features: on, playerId: CFG.playerId || '',
    autostart: STATE.autostart, log: LOG.slice(-40) };
}

// ---- Démarrage automatique avec Windows (clé de registre HKCU\...\Run) ----
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const RUN_NAME = 'ARCHI Link';
function isAutostart() {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise(resolve => execFile('reg', ['query', RUN_KEY, '/v', RUN_NAME], { windowsHide: true },
    (err, out) => resolve(!err && /ARCHI Link/i.test(out || ''))));
}
function setAutostart(on) {
  if (process.platform !== 'win32') { STATE.autostart = !!on; return Promise.resolve(); }
  const exe = process.execPath;   // en .exe : l'exécutable
  const args = on ? ['add', RUN_KEY, '/v', RUN_NAME, '/t', 'REG_SZ', '/d', '"' + exe + '"', '/f']
                  : ['delete', RUN_KEY, '/v', RUN_NAME, '/f'];
  return new Promise((resolve, reject) => execFile('reg', args, { windowsHide: true },
    err => { if (err && !/introuvable|unable to find|cannot find/i.test(String(err))) return reject(err); STATE.autostart = !!on; resolve(); }));
}
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
    STATE.leagueOpen = false;
    if (!warnedClosed) { log('⏳ client League fermé — en attente (ouvre le client pour lire le rang).'); warnedClosed = true; }
    scanReplays();                                // les .rofl se lisent même client fermé
    return;
  }
  STATE.leagueOpen = true;
  warnedClosed = false;
  try {
    const rank = await fetchRank(lock);
    writeJson(RANK_FILE, rank);
    appendHistory(rank);
    STATE.riotId = rank.riotId; STATE.rankLabel = rankLabel(rank.solo);
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
  if (!(CFG.features && CFG.features.wiki)) return;   // option "wiki" désactivée
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
  const f = CFG.features || {}, a = CFG.auth || {};
  if (!(f.rank || f.soloq)) return;                  // aucune option d'envoi SoloQ cochée
  if (!a.username || !a.password || !CFG.playerId) { log('⚠ envoi activé mais connexion non configurée — lance avec --setup.'); return; }
  if (!rank || !rank.solo) return;
  const doc = { riotId: rank.riotId, puuid: rank.puuid, updatedAt: rank.updatedAt };
  if (f.rank) doc.solo = rank.solo;                                   // elo + winrate
  if (f.soloq) { doc.history = readJson(HISTORY_FILE, []).slice(-60); doc.recent = (recent || []).slice(0, 10); }  // historique + parties
  try {
    await pushStats({ username: a.username, password: a.password, playerId: CFG.playerId }, doc);
    STATE.lastPush = new Date().toLocaleTimeString('fr-FR'); STATE.lastPushOk = true;
    log('☁ envoyé à ARCHI (plazma-stats/' + CFG.playerId + ') · ' + [f.rank && 'rang', f.soloq && 'SoloQ'].filter(Boolean).join('+'));
  } catch (e) { STATE.lastPush = new Date().toLocaleTimeString('fr-FR'); STATE.lastPushOk = false; log('⚠ envoi ARCHI impossible :', e.message); }
}

function logFeatures() {
  if (CFG._configError) { log('❌ config.json illisible :', CFG._configError, '— lance avec --setup pour le régénérer.'); return; }
  const f = CFG.features || {}, a = CFG.auth || {};
  const on = []; if (f.rank) on.push('rang & winrate'); if (f.soloq) on.push('SoloQ & replays'); if (f.wiki) on.push('wiki');
  if (a.username && CFG.playerId && on.length) log('☁ Partage ARCHI : ' + on.join(', ') + ' (joueur ' + CFG.playerId + ').');
  else log('☁ Partage ARCHI : rien de configuré — lance avec --setup pour choisir.');
}
function openSetup() {
  try { require('./ui').startSetup({ configPath: path.join(HERE, 'config.json'), config: CFG, appName: APP_NAME, onSaved: () => reloadConfig() }); }
  catch (e) { log('⚠ fenêtre de configuration indisponible :', e.message); }
}
let _trayProc = null, _server = null;
function quit() {
  log('⏹ arrêt demandé.');
  try { if (_trayProc) _trayProc.kill(); } catch (e) {}
  try { if (_server && _server.server) _server.server.close(); } catch (e) {}
  setTimeout(() => process.exit(0), 200);
}
async function main() {
  ensureDirs();
  log('— ' + APP_NAME + ' démarre — sorties : ' + OUT);
  log('Lockfile : ' + CFG.lockfile);
  log('Replays  : ' + CFG.replaysDir);
  logFeatures();
  // Serveur local (page d'état + configuration), toujours actif.
  try {
    _server = await startServer({
      configPath: path.join(HERE, 'config.json'), appName: APP_NAME,
      getConfig: () => CFG, getStatus, onSaved: () => reloadConfig(),
      isAutostart, setAutostart, onQuit: quit,
    });
    try { fs.writeFileSync(path.join(OUT, 'port.txt'), String(_server.port)); } catch (e) {}
    log('🔌 interface locale : ' + _server.url);
    // Icône dans la barre des tâches (Windows).
    _trayProc = tray.start(_server.url, { dir: OUT, appName: APP_NAME });
    if (_trayProc) log('🔔 icône de barre des tâches active.');
    // Fenêtre au premier lancement ou avec --setup.
    if (process.argv.includes('--setup') || !CFG._configFound) {
      log('⚙ Ouverture de la fenêtre de configuration…');
      _server.open(_server.url + (CFG._configFound ? '' : '?setup=1'));
    }
  } catch (e) { log('⚠ interface locale indisponible :', e.message); }
  isAutostart().then(v => { STATE.autostart = v; }).catch(() => {});
  watchReplays();
  cycle();
  setInterval(cycle, Math.max(1, +CFG.pollMinutes || 5) * 60 * 1000);
}
main();
