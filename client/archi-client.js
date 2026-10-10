#!/usr/bin/env node
/*
 * ARCHI Link — client local d'ARCHI
 * ---------------------------------
 * En local, sans aucune clé Riot :
 *   1) lit le rang SoloQ (API locale du client League, « LCU ») ;
 *   2) parse les replays .rofl ; 3) tient l'historique SoloQ ;
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
const { execFile } = require('child_process');
const APP_NAME = 'ARCHI Link';
let VERSION = '0.0.0';
try { VERSION = require('./package.json').version || VERSION; } catch (e) {}
const REPO = 'HaitoDann/PlaZma';                     // pour la vérif de mise à jour

// En .exe (pkg), les fichiers (config.json, archi-data) sont à côté de l'exécutable ;
// en Node classique, à côté du script.
const HERE = process.pkg ? path.dirname(process.execPath) : __dirname;
const OUT = path.join(HERE, 'archi-data');
const REPLAYS_OUT = path.join(OUT, 'replays');
const HISTORY_FILE = path.join(OUT, 'soloq-history.json');
const RANK_FILE = path.join(OUT, 'rank.json');
const INDEX_FILE = path.join(OUT, 'replays-index.json');
const MATCHES_FILE = path.join(OUT, 'soloq-matches.json');   // historique SoloQ accumulé
const LOG_FILE = path.join(OUT, 'log.txt');

// ---- Config (client/config.json, sinon valeurs par défaut Windows) ----
function loadConfig() {
  const defaults = {
    lockfile: 'C:\\Riot Games\\League of Legends\\lockfile',
    replaysDir: path.join(os.homedir(), 'Documents', 'League of Legends', 'Replays'),
    pollMinutes: 5,
    auth: { username: '', password: '' },
    playerId: '',
    features: { rank: true, soloq: true },
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
    merged.features = { rank: !!c.push.enabled, soloq: !!c.push.enabled };
  }
  merged.auth = Object.assign({ username: '', password: '' }, merged.auth);
  merged.features = Object.assign({ rank: true, soloq: true }, merged.features);
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
const STATE = { leagueOpen: false, riotId: '', rankLabel: '', lastPush: '', lastPushOk: false, lastPushMsg: '', autostart: null,
  updateAvailable: false, latestVersion: '' };
function getStatus() {
  const f = CFG.features || {}; const on = [];
  if (f.rank) on.push('rang'); if (f.soloq) on.push('SoloQ/.rofl');
  return { appName: APP_NAME, version: VERSION, leagueOpen: STATE.leagueOpen, riotId: STATE.riotId, rankLabel: STATE.rankLabel,
    lastPush: STATE.lastPush, lastPushOk: STATE.lastPushOk, lastPushMsg: STATE.lastPushMsg, features: on, playerId: CFG.playerId || '',
    autostart: STATE.autostart, updateAvailable: STATE.updateAvailable, latestVersion: STATE.latestVersion,
    log: LOG.slice(-40) };
}

// ---- Vérification de mise à jour (GitHub Releases, sans clé) ----
function cmpVer(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return 1; if ((pa[i] || 0) < (pb[i] || 0)) return -1; }
  return 0;
}
function checkUpdate() {
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.github.com', path: '/repos/' + REPO + '/releases/latest', method: 'GET',
      headers: { 'User-Agent': 'ARCHI-Link', 'Accept': 'application/vnd.github+json' }, timeout: 6000,
    }, res => {
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => { try { const j = JSON.parse(b); resolve((j.tag_name || '').replace(/[^0-9.]/g, '') || null); } catch (e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
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
// Le lockfile n'existe que lorsque le client League tourne. On essaie le chemin
// configuré, puis les emplacements d'installation courants (toutes lettres de
// lecteur), pour marcher même si League est installé ailleurs que C:\Riot Games.
let _lockPath = null;
function lockCandidates() {
  const list = [];
  if (CFG.lockfile) list.push(CFG.lockfile);
  const subs = ['Riot Games\\League of Legends', 'Program Files\\Riot Games\\League of Legends',
    'Program Files (x86)\\Riot Games\\League of Legends', 'Games\\Riot Games\\League of Legends'];
  for (const d of ['C', 'D', 'E', 'F', 'G']) for (const s of subs) list.push(d + ':\\' + s + '\\lockfile');
  return [...new Set(list)];
}
function findLockfile() {
  if (_lockPath) { try { fs.accessSync(_lockPath); return _lockPath; } catch (e) { _lockPath = null; } }
  for (const p of lockCandidates()) {
    try { fs.accessSync(p); _lockPath = p; if (p !== CFG.lockfile) log('📁 client League détecté :', p); return p; }
    catch (e) {}
  }
  return null;
}
// Détection automatique via le processus League en cours (marche quel que soit
// le disque / dossier d'installation). Lit la ligne de commande de LeagueClientUx.
function detectLockViaProcess() {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise(resolve => {
    execFile('powershell', ['-NoProfile', '-Command',
      "(Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\").CommandLine"],
      { windowsHide: true, timeout: 8000 }, (err, out) => {
        if (err || !out) return resolve(null);
        let dir = (String(out).match(/--install-directory=([^"]+?)(?:"|\s--|\s*$)/i) || [])[1];
        if (!dir) { const e = String(out).match(/"?([A-Za-z]:\\[^"]+?)\\LeagueClientUx\.exe/i); if (e) dir = e[1]; }
        if (!dir) return resolve(null);
        resolve(path.join(dir.trim(), 'lockfile'));
      });
  });
}
function readLockfile() {
  const file = findLockfile();
  if (!file) return null;                          // client League fermé
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch (e) { return null; }
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

// ---- Historique de parties classées (SoloQ) : données brutes riches ----
// Lit jusqu'à 200 parties classées depuis le client, avec un maximum de stats
// par partie (CS, gold, vision, dégâts, multi-kills, rôle…) — la matière première.
async function fetchRankedMatches(lock) {
  try {
    const mh = await lcuGet(lock, '/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=199');
    const games = (mh && mh.games && mh.games.games) || [];
    return games.filter(g => g.queueId === 420).map(g => {
      const me = (g.participants && g.participants[0]) || {};
      const st = me.stats || {}, tl = me.timeline || {};
      const dur = g.gameDuration || 0, min = (dur / 60) || 1;
      const cs = (st.totalMinionsKilled || 0) + (st.neutralMinionsKilled || 0);
      return {
        gameId: g.gameId, ts: g.gameCreation, durationSec: dur,
        champ: me.championId, win: !!st.win,
        k: st.kills || 0, d: st.deaths || 0, a: st.assists || 0,
        cs, csmin: Math.round(cs / min * 10) / 10,
        gold: st.goldEarned || 0, vision: st.visionScore || 0,
        dmg: st.totalDamageDealtToChampions || 0, dmgTaken: st.totalDamageTaken || 0,
        champLevel: st.champLevel || 0,
        doubleKills: st.doubleKills || 0, tripleKills: st.tripleKills || 0,
        quadraKills: st.quadraKills || 0, pentaKills: st.pentaKills || 0,
        role: tl.role || '', lane: tl.lane || '',
      };
    });
  } catch (e) { return null; }
}
// Accumule l'historique SoloQ dans le temps (dédoublonnage par gameId), cap à 500.
function mergeMatches(fresh) {
  const byId = {};
  (readJson(MATCHES_FILE, []) || []).forEach(m => { if (m && m.gameId != null) byId[m.gameId] = m; });
  (fresh || []).forEach(m => { if (m && m.gameId != null) byId[m.gameId] = m; });
  const all = Object.values(byId).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 500);
  writeJson(MATCHES_FILE, all);
  return all;
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
async function cycle(forced) {
  let lock = readLockfile();
  if (!lock) {
    // Scan par chemins échoué : tente de localiser League via son processus.
    try { const p = await detectLockViaProcess(); if (p) { fs.accessSync(p); _lockPath = p; log('📁 client League détecté (via processus) :', p); lock = readLockfile(); } } catch (e) {}
  }
  if (!lock) {
    STATE.leagueOpen = false;
    if (!warnedClosed || forced) { log('⏳ client League fermé (ou introuvable) — ouvre le client League ; s\'il est déjà ouvert, indique son dossier dans Configuration.'); warnedClosed = true; }
    scanReplays();                                // les .rofl se lisent même client fermé
    return;
  }
  STATE.leagueOpen = true;
  warnedClosed = false;
  // Chaque étape est isolée : si l'une échoue, les autres continuent
  // (p. ex. l'historique de parties peut manquer sans bloquer l'envoi).
  let rank = null, matches = null;
  try {
    rank = await fetchRank(lock);
    writeJson(RANK_FILE, rank);
    appendHistory(rank);
    STATE.riotId = rank.riotId; STATE.rankLabel = rankLabel(rank.solo);
    log('👤', rank.riotId, '—', rankLabel(rank.solo));
  } catch (e) { log('⚠ lecture du rang impossible :', e.message); }
  try {
    const fresh = await fetchRankedMatches(lock);
    if (fresh) { matches = mergeMatches(fresh); if (matches.length) log('🗂 historique SoloQ : ' + matches.length + ' parties classées (cumul).'); }
    else matches = readJson(MATCHES_FILE, []);
  } catch (e) { log('⚠ historique SoloQ indisponible :', e.message); matches = readJson(MATCHES_FILE, []); }
  if (rank) { try { await maybePush(rank, matches); } catch (e) { log('⚠ envoi ARCHI :', e.message); } }
  scanReplays();
}


async function maybePush(rank, matches) {
  const f = CFG.features || {}, a = CFG.auth || {};
  if (!(f.rank || f.soloq)) return;                  // aucune option d'envoi SoloQ cochée
  if (!a.username || !a.password || !CFG.playerId) { log('⚠ envoi activé mais connexion non configurée — lance avec --setup.'); return; }
  if (!rank || !rank.solo) { log('⚠ rang SoloQ indisponible (non classé, ou le client n\'a pas encore chargé le rang) — rien à envoyer pour l\'instant.'); return; }
  const doc = { riotId: rank.riotId, puuid: rank.puuid, updatedAt: rank.updatedAt };
  if (f.rank) doc.solo = rank.solo;                                   // elo + winrate
  if (f.soloq) {
    doc.history = readJson(HISTORY_FILE, []).slice(-120);           // points de rang (courbe LP)
    doc.matches = (matches || []).slice(0, 300);                    // historique SoloQ accumulé (riche)
    doc.recent = (matches || []).slice(0, 10);                      // compat ancienne page
  }
  try {
    await pushStats({ username: a.username, password: a.password, playerId: CFG.playerId }, doc);
    STATE.lastPush = new Date().toLocaleTimeString('fr-FR'); STATE.lastPushOk = true; STATE.lastPushMsg = 'Envoyé (' + rankLabel(rank.solo) + ')';
    log('☁ envoyé à ARCHI (plazma-stats/' + CFG.playerId + ') · ' + [f.rank && 'rang', f.soloq && 'SoloQ'].filter(Boolean).join('+'));
  } catch (e) {
    STATE.lastPush = new Date().toLocaleTimeString('fr-FR'); STATE.lastPushOk = false;
    STATE.lastPushMsg = /403|permission|PERMISSION/.test(String(e.message)) ? 'Refusé par ARCHI : ton compte n\'est pas lié à ce joueur (demande à un admin).' : e.message;
    log('⚠ envoi ARCHI impossible :', e.message);
  }
}

function logFeatures() {
  if (CFG._configError) { log('❌ config.json illisible :', CFG._configError, '— lance avec --setup pour le régénérer.'); return; }
  const f = CFG.features || {}, a = CFG.auth || {};
  const on = []; if (f.rank) on.push('rang & winrate'); if (f.soloq) on.push('SoloQ & replays');
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
  log('— ' + APP_NAME + ' v' + VERSION + ' démarre — sorties : ' + OUT);
  log('Lockfile : ' + CFG.lockfile);
  log('Replays  : ' + CFG.replaysDir);
  logFeatures();
  // Serveur local (page d'état + configuration), toujours actif.
  try {
    _server = await startServer({
      configPath: path.join(HERE, 'config.json'), appName: APP_NAME,
      getConfig: () => CFG, getStatus,
      onSaved: async () => {
        const firstSetup = !(CFG.auth && CFG.auth.username);   // non configuré avant cet enregistrement
        reloadConfig();
        // À la première configuration, on active le démarrage auto pour que
        // « ça tourne tout seul » (le joueur peut le retirer depuis la page d'état).
        if (firstSetup && STATE.autostart !== true) {
          try { await setAutostart(true); log('🔁 démarrage automatique activé.'); } catch (e) {}
        }
        cycle();
      },
      onRun: async () => { log('🔄 synchro forcée…'); await cycle(true); return getStatus(); },
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
  checkUpdate().then(latest => {
    if (!latest) return;
    STATE.latestVersion = latest;
    if (cmpVer(latest, VERSION) > 0) {
      STATE.updateAvailable = true;
      log('⬆ Mise à jour disponible : v' + latest + ' (installée : v' + VERSION + '). Télécharge la dernière version.');
    }
  }).catch(() => {});
  watchReplays();
  cycle();
  setInterval(cycle, Math.max(1, +CFG.pollMinutes || 5) * 60 * 1000);
}
main();
