// Serveur local d'ARCHI Link (toujours actif) : page d'état + configuration.
// Léger (pas d'Electron) : une petite page HTML servie sur 127.0.0.1, ouverte
// dans le navigateur par défaut quand on clique sur l'icône du tray.
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

// opts : { configPath, appName, getConfig(), getStatus(), onSaved(cfg), onQuit(),
//          isAutostart(), setAutostart(bool) }
function startServer(opts) {
  const srv = http.createServer(async (req, res) => {
    try {
      const url = req.url.split('?')[0];
      if (req.method === 'GET' && url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(PAGE(opts.appName || 'ARCHI Link'));
      }
      if (req.method === 'GET' && url === '/api/config') {
        const c = opts.getConfig(); const f = c.features || {};
        return json(res, 200, {
          appName: opts.appName || 'ARCHI Link',
          username: (c.auth && c.auth.username) || '',
          playerId: c.playerId || '',
          features: { rank: f.rank !== false, soloq: f.soloq !== false, wiki: !!f.wiki },
        });
      }
      if (req.method === 'GET' && url === '/api/status') {
        let auto = null; try { auto = opts.isAutostart ? await opts.isAutostart() : null; } catch (e) {}
        return json(res, 200, Object.assign({ autostart: auto }, opts.getStatus ? opts.getStatus() : {}));
      }
      if (req.method === 'POST' && url === '/api/test') {
        const b = await readBody(req);
        try { const r = await push.checkAccount(b.username, b.password); return json(res, 200, r); }
        catch (e) { return json(res, 200, { ok: false, error: frError(e.message) }); }
      }
      if (req.method === 'POST' && url === '/api/save') {
        const b = await readBody(req);
        if (!b.username || !b.password) return json(res, 200, { ok: false, error: 'Identifiants requis.' });
        if (!b.playerId) return json(res, 200, { ok: false, error: 'Identifiant joueur requis.' });
        const cur = opts.getConfig();
        const next = Object.assign({}, cur, {
          auth: { username: b.username, password: b.password },
          playerId: b.playerId,
          features: { rank: !!b.features.rank, soloq: !!b.features.soloq, wiki: !!b.features.wiki },
        });
        delete next.push;
        try { fs.writeFileSync(opts.configPath, JSON.stringify(stripInternal(next), null, 2)); }
        catch (e) { return json(res, 200, { ok: false, error: 'Écriture impossible : ' + e.message }); }
        push.resetToken();
        if (opts.onSaved) try { opts.onSaved(next); } catch (e) {}
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && url === '/api/autostart') {
        const b = await readBody(req);
        try { if (opts.setAutostart) await opts.setAutostart(!!b.on); return json(res, 200, { ok: true, on: !!b.on }); }
        catch (e) { return json(res, 200, { ok: false, error: e.message }); }
      }
      if ((req.method === 'POST' || req.method === 'GET') && url === '/api/quit') {
        json(res, 200, { ok: true });
        setTimeout(() => { if (opts.onQuit) opts.onQuit(); else process.exit(0); }, 150);
        return;
      }
      res.writeHead(404); res.end();
    } catch (e) { json(res, 500, { error: String(e.message || e) }); }
  });
  return new Promise(resolve => {
    srv.listen(0, '127.0.0.1', () => resolve({ server: srv, port: srv.address().port, url: 'http://127.0.0.1:' + srv.address().port + '/', open: openBrowser }));
  });
}

function stripInternal(c) { const o = Object.assign({}, c); for (const k of Object.keys(o)) if (k[0] === '_') delete o[k]; return o; }
function frError(m) {
  m = String(m || '');
  if (/INVALID_LOGIN|INVALID_PASSWORD|INVALID_EMAIL|EMAIL_NOT_FOUND/.test(m)) return 'Identifiant ou mot de passe incorrect.';
  if (/timeout|ENOTFOUND|ECONNRESET/.test(m)) return 'Connexion à ARCHI impossible (réseau).';
  return m;
}

module.exports = { startServer, openBrowser };
