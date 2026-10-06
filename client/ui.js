// Fenêtre de configuration d'ARCHI Link.
// Pour rester léger (pas d'Electron), on sert une petite page HTML en local
// (127.0.0.1) et on l'ouvre dans le navigateur par défaut. La page teste la
// connexion ARCHI et écrit dynamiquement config.json.
'use strict';
const http = require('http');
const fs = require('fs');
const { exec } = require('child_process');
const push = require('./push');

const PAGE = require('./ui-page');

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
            : process.platform === 'darwin' ? `open "${url}"`
            : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function readBody(req) {
  return new Promise(resolve => {
    let b = ''; req.on('data', d => { b += d; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
  });
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

// opts : { configPath, config, onSaved(newConfig), appName }
function startSetup(opts) {
  const cfg = opts.config || {};
  const srv = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(PAGE(opts.appName || 'ARCHI Link'));
      }
      if (req.method === 'GET' && req.url === '/api/config') {
        const f = cfg.features || {};
        return json(res, 200, {
          appName: opts.appName || 'ARCHI Link',
          username: (cfg.auth && cfg.auth.username) || '',
          playerId: cfg.playerId || '',
          features: { rank: f.rank !== false, soloq: f.soloq !== false, wiki: !!f.wiki },
        });
      }
      if (req.method === 'POST' && req.url === '/api/test') {
        const b = await readBody(req);
        try { const r = await push.checkAccount(b.username, b.password); return json(res, 200, r); }
        catch (e) { return json(res, 200, { ok: false, error: frError(e.message) }); }
      }
      if (req.method === 'POST' && req.url === '/api/save') {
        const b = await readBody(req);
        if (!b.username || !b.password) return json(res, 200, { ok: false, error: 'Identifiants requis.' });
        if (!b.playerId) return json(res, 200, { ok: false, error: 'Identifiant joueur requis.' });
        const next = Object.assign({}, cfg, {
          auth: { username: b.username, password: b.password },
          playerId: b.playerId,
          features: { rank: !!b.features.rank, soloq: !!b.features.soloq, wiki: !!b.features.wiki },
        });
        delete next.push; // migration : on abandonne l'ancien bloc
        try { fs.writeFileSync(opts.configPath, JSON.stringify(stripInternal(next), null, 2)); }
        catch (e) { return json(res, 200, { ok: false, error: 'Écriture impossible : ' + e.message }); }
        push.resetToken();
        if (opts.onSaved) try { opts.onSaved(next); } catch (e) {}
        return json(res, 200, { ok: true });
      }
      res.writeHead(404); res.end();
    } catch (e) { json(res, 500, { error: String(e.message || e) }); }
  });
  srv.listen(0, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + srv.address().port + '/';
    console.log('   Fenêtre de configuration : ' + url);
    openBrowser(url);
  });
  return srv;
}

function stripInternal(c) { const o = Object.assign({}, c); for (const k of Object.keys(o)) if (k[0] === '_') delete o[k]; return o; }
function frError(m) {
  m = String(m || '');
  if (/INVALID_LOGIN|INVALID_PASSWORD|INVALID_EMAIL|EMAIL_NOT_FOUND/.test(m)) return 'Identifiant ou mot de passe incorrect.';
  if (/timeout|ENOTFOUND|ECONNRESET/.test(m)) return 'Connexion à ARCHI impossible (réseau).';
  return m;
}

module.exports = { startSetup };
