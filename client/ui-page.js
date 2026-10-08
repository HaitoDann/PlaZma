// Page HTML d'ARCHI Link (état + configuration), servie en local par ui.js.
'use strict';
module.exports = function PAGE(appName) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${appName}</title>
<style>
:root{--bg:#0e1013;--surface:#15181c;--surface2:#1a1e23;--border:#262b32;--border2:#323841;
  --text:#e7e9ec;--dim:#a4abb4;--muted:#6e7681;--accent:#4cb8cc;--accent2:#2f93a6;--ok:#3fa66b;--err:#d0534f;--warn:#c9912e;
  --font:'Segoe UI',system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;line-height:1.5;
  display:flex;justify-content:center;padding:28px 16px 60px}
.wrap{width:560px;max-width:100%}
h1{font-size:20px;font-weight:600;margin:0 0 2px}
.sub{color:var(--muted);font-size:13px;margin-bottom:22px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px 20px;margin-bottom:16px}
.card h2{font-size:14px;font-weight:600;margin:0 0 4px}
.card .hint{color:var(--muted);font-size:12.5px;margin-bottom:14px}
.stat{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--border);font-size:13px}
.stat:first-of-type{border-top:0}
.stat .k{color:var(--dim)}
.stat .v{font-weight:500;text-align:right}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:1px}
.dot.on{background:var(--ok)}.dot.off{background:var(--muted)}.dot.err{background:var(--err)}
.loglines{margin-top:12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px 12px;
  font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:var(--dim);max-height:160px;overflow:auto;white-space:pre-wrap}
label.sw{display:flex;align-items:center;gap:9px;font-size:13px;margin-top:12px;cursor:pointer}
label.sw input{width:16px;height:16px;accent-color:var(--accent)}
label.f{display:block;font-size:12.5px;color:var(--dim);margin:12px 0 5px}
input[type=text],input[type=password]{width:100%;padding:9px 11px;background:var(--bg);border:1px solid var(--border2);
  border-radius:6px;color:var(--text);font-size:14px;font-family:inherit}
input:focus{outline:none;border-color:var(--accent)}
.row{display:flex;gap:10px}.row>div{flex:1}
button{font-family:inherit;font-size:14px;font-weight:500;border-radius:6px;cursor:pointer;padding:9px 16px;border:1px solid var(--border2);background:var(--surface2);color:var(--text)}
button:hover{background:var(--border)}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}button.primary:hover{background:var(--accent2)}
button:disabled{opacity:.5;cursor:default}
.status{margin-top:12px;font-size:13px;min-height:18px}
.status.ok{color:var(--ok)}.status.err{color:var(--err)}.status.wait{color:var(--muted)}
.feat{display:flex;gap:12px;padding:12px 0;border-top:1px solid var(--border)}.feat:first-of-type{border-top:0}
.feat input{margin-top:3px;width:17px;height:17px;flex-shrink:0;accent-color:var(--accent)}
.feat .ft{font-weight:600;font-size:13.5px}.feat .fd{color:var(--dim);font-size:12.5px;margin-top:2px}
.feat .fi{color:var(--muted);font-size:12px;margin-top:5px}.feat .fi b{color:var(--dim)}
.saverow{display:flex;justify-content:space-between;align-items:center;gap:12px}
.whoami{color:var(--dim);font-size:12.5px}.whoami b{color:var(--text)}
code{background:var(--surface2);padding:1px 5px;border-radius:4px;font-size:12px}
.tabs{display:flex;gap:4px;margin-bottom:16px}
.tab{padding:7px 14px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--muted);cursor:pointer}
.tab.on{background:var(--accent);border-color:var(--accent);color:#fff}
.pane{display:none}.pane.on{display:block}
</style></head>
<body><div class="wrap">
  <h1>${appName}</h1>
  <div class="sub">Compagnon local d'ARCHI. Il tourne en fond ; ferme cette fenêtre quand tu veux, ${appName} continue.</div>
  <div class="tabs"><div class="tab on" data-tab="etat">État</div><div class="tab" data-tab="config">Configuration</div></div>

  <div class="pane on" id="pane-etat">
    <div class="card">
      <h2>État</h2>
      <div id="upd" style="display:none;margin:-4px 0 12px;padding:9px 12px;border-radius:8px;
        background:rgba(76,184,204,.14);border:1px solid rgba(76,184,204,.5);font-size:13px"></div>
      <div class="stat"><span class="k">Client League</span><span class="v" id="s-league">—</span></div>
      <div class="stat"><span class="k">Compte</span><span class="v" id="s-riot">—</span></div>
      <div class="stat"><span class="k">Rang SoloQ</span><span class="v" id="s-rank">—</span></div>
      <div class="stat"><span class="k">Dernier envoi à ARCHI</span><span class="v" id="s-push">—</span></div>
      <div class="stat"><span class="k">Partage actif</span><span class="v" id="s-feat">—</span></div>
      <label class="sw"><input type="checkbox" id="auto"> Démarrer automatiquement avec Windows</label>
      <div class="loglines" id="log">…</div>
      <div class="saverow" style="margin-top:14px"><span class="whoami" id="s-ver">Journal des dernières actions.</span>
        <button id="quit">Quitter ${appName}</button></div>
    </div>
  </div>

  <div class="pane" id="pane-config">
    <div class="card">
      <h2>Connexion ARCHI</h2>
      <div class="hint">Les mêmes identifiants que sur le site. Le mot de passe reste sur ton PC (<code>config.json</code>).</div>
      <div class="row">
        <div><label class="f" for="u">Identifiant</label><input id="u" type="text" placeholder="ton pseudo ARCHI"></div>
        <div><label class="f" for="p">Mot de passe</label><input id="p" type="password" placeholder="••••••••"></div>
      </div>
      <div style="margin-top:12px"><button id="test">Tester la connexion</button></div>
      <div class="status" id="st-login"></div>
    </div>
    <div class="card">
      <h2>Ce que ${appName} partage</h2>
      <div class="hint">Coche uniquement ce que tu veux. Revenir ici à tout moment.</div>
      <label class="feat"><input type="checkbox" id="f-rank" checked>
        <div><div class="ft">Rang & winrate SoloQ</div><div class="fd">Fait remonter ton elo (tier, division, LP) et ton winrate.</div>
          <div class="fi"><b>Impact :</b> quasi nul — une petite requête toutes les 5 min quand League est ouvert.</div></div></label>
      <label class="feat"><input type="checkbox" id="f-soloq" checked>
        <div><div class="ft">Historique & suivi SoloQ (+ replays .rofl)</div><div class="fd">Historique du rang, dernières parties, lecture des replays .rofl.</div>
          <div class="fi"><b>Impact :</b> léger — surveillance du dossier des replays ; l'analyse d'un replay est brève.</div></div></label>
    </div>
    <div class="card"><div class="saverow">
      <div class="whoami" id="who">Teste d'abord ta connexion.</div>
      <button class="primary" id="save" disabled>Enregistrer</button></div>
      <div class="status" id="st-save"></div></div>
  </div>
</div>
<script>
const $=id=>document.getElementById(id);
const api=(p,o)=>fetch(p,o).then(r=>r.json());
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===t));
  document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id==='pane-'+t.dataset.tab));
}));
if(location.search.indexOf('setup')>=0) document.querySelector('.tab[data-tab=config]').click();

let detected={playerId:''};
(async()=>{ try{ const c=await api('/api/config'); $('u').value=c.username||''; detected.playerId=c.playerId||'';
  $('f-rank').checked=c.features.rank; $('f-soloq').checked=c.features.soloq; }catch(e){} })();

async function poll(){ try{ const s=await api('/api/status');
  $('s-league').innerHTML = s.leagueOpen ? '<span class="dot on"></span>ouvert' : '<span class="dot off"></span>fermé';
  $('s-riot').textContent = s.riotId||'—';
  $('s-rank').textContent = s.rankLabel||'—';
  $('s-push').innerHTML = s.lastPush ? ((s.lastPushOk?'<span class="dot on"></span>':'<span class="dot err"></span>')+s.lastPush) : '—';
  $('s-feat').textContent = (s.features&&s.features.length)? s.features.join(', ') : 'rien';
  if(s.autostart!==null && document.activeElement!==$('auto')) $('auto').checked=!!s.autostart;
  if(Array.isArray(s.log)) $('log').textContent = s.log.join('\\n');
  if(s.version) $('s-ver').textContent = '${appName} v'+s.version;
  const up=$('upd');
  if(s.updateAvailable){ up.style.display='block';
    up.innerHTML='⬆ Mise à jour disponible (v'+(s.latestVersion||'?')+'). '+
      '<a href="https://github.com/HaitoDann/PlaZma/releases/latest" target="_blank" rel="noopener" style="color:inherit;font-weight:600">Télécharger la dernière version</a>.'; }
  else up.style.display='none';
}catch(e){} }
poll(); setInterval(poll, 3000);

$('auto').addEventListener('change', async()=>{ await api('/api/autostart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({on:$('auto').checked})}); });
$('quit').addEventListener('click', async()=>{ if(confirm('Quitter ${appName} ? Il ne tournera plus en fond.')){ await api('/api/quit',{method:'POST'}); document.body.innerHTML='<div style="padding:40px;color:#a4abb4">ARCHI Link s\\'est arrêté. Tu peux fermer cette fenêtre.</div>'; } });

$('test').addEventListener('click', async ()=>{
  const u=$('u').value.trim(), p=$('p').value;
  if(!u||!p){ setLogin('err','Renseigne identifiant et mot de passe.'); return; }
  setLogin('wait','Connexion à ARCHI…'); $('test').disabled=true;
  const r=await api('/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
  $('test').disabled=false;
  if(!r.ok){ setLogin('err','✕ '+(r.error||'Échec.')); $('save').disabled=true; return; }
  detected.playerId=r.playerId||detected.playerId;
  detected.playerName=r.playerName||r.playerId||'';
  setLogin('ok','✓ Connecté'+(r.name?' en tant que '+r.name:'')+'.');
  const pid=detected.playerId;
  $('who').innerHTML = pid ? 'Compte lié au joueur <b>'+(detected.playerName||pid)+'</b>.' :
    'Aucun joueur lié. <b>Un admin</b> doit le lier (page Comptes), sinon l\\'envoi sera refusé.';
  $('save').disabled = !pid && !(r.role==='admin');
  if(!pid && r.role==='admin'){ $('who').innerHTML='Compte admin — précise le joueur à alimenter :'+
    ' <input id="pidIn" type="text" placeholder="ex. haito" style="width:140px;margin-left:6px">';
    $('pidIn').addEventListener('input',e=>{ detected.playerId=e.target.value.trim(); $('save').disabled=!detected.playerId; }); }
});
$('save').addEventListener('click', async ()=>{
  const body={ username:$('u').value.trim(), password:$('p').value, playerId:detected.playerId,
    features:{ rank:$('f-rank').checked, soloq:$('f-soloq').checked } };
  setSave('wait','Enregistrement…'); $('save').disabled=true;
  const r=await api('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  $('save').disabled=false;
  if(r.ok) setSave('ok','✓ Enregistré. ${appName} applique tes choix.');
  else setSave('err','✕ '+(r.error||'Échec.'));
});
function setLogin(c,t){ const e=$('st-login'); e.className='status '+c; e.textContent=t; }
function setSave(c,t){ const e=$('st-save'); e.className='status '+c; e.textContent=t; }
</script>
</body></html>`;
};
