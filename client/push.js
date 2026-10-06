// Envoi des stats vers ARCHI (Firestore), authentifié avec le compte ARCHI du
// joueur. Aucune donnée secrète côté serveur : on se connecte en HTTPS comme le
// ferait le site, et les règles Firestore autorisent le joueur à écrire son
// propre document plazma-stats/<playerId>.
'use strict';
const https = require('https');

// Config Firebase publique (identique à celle du site ARCHI).
const FIREBASE = {
  apiKey: 'AIzaSyAKwNEbNa6f40oSMwGp6dcDY1ZY6hUN1Ks',
  projectId: 'plazma-esport',
};
const USER_DOMAIN = 'archi.local';
const normUser = u => String(u || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }, timeout: 10000,
    }, res => {
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => { try { const j = JSON.parse(b); res.statusCode < 300 ? resolve(j) : reject(new Error((j.error && j.error.message) || ('HTTP ' + res.statusCode))); } catch (e) { reject(e); } });
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(data); req.end();
  });
}

// ---- Sérialisation valeur JS -> format REST Firestore ----
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(obj) { const f = {}; for (const k of Object.keys(obj)) f[k] = toValue(obj[k]); return f; }

let _token = null, _tokenExp = 0;
async function getToken(username, password) {
  if (_token && Date.now() < _tokenExp) return _token;
  const email = normUser(username) + '@' + USER_DOMAIN;
  const r = await postJson(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + FIREBASE.apiKey,
    { email, password, returnSecureToken: true });
  _token = r.idToken; _tokenExp = Date.now() + (Math.max(60, (+r.expiresIn || 3600) - 300)) * 1000;
  return _token;
}

// Écrit (remplace) le document plazma-stats/<playerId>.
async function pushStats(cfg, doc) {
  const token = await getToken(cfg.username, cfg.password);
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents/plazma-stats/${encodeURIComponent(cfg.playerId)}`;
  const body = JSON.stringify({ fields: toFields(doc) });
  const data = Buffer.from(body);
  const u = new URL(url);
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, Authorization: 'Bearer ' + token }, timeout: 10000,
    }, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => res.statusCode < 300 ? resolve() : reject(new Error('Firestore HTTP ' + res.statusCode + ' ' + b.slice(0, 200)))); });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(data); req.end();
  });
}

module.exports = { pushStats };
