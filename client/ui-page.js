// Page HTML de configuration d'ARCHI Link (servie en local par ui.js).
'use strict';
module.exports = function PAGE(appName) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${appName} — Configuration</title>
<style>
:root{--bg:#0e1013;--surface:#15181c;--surface2:#1a1e23;--border:#262b32;--border2:#323841;
  --text:#e7e9ec;--dim:#a4abb4;--muted:#6e7681;--accent:#4cb8cc;--accent2:#2f93a6;--ok:#3fa66b;--err:#d0534f;
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
label.f{display:block;font-size:12.5px;color:var(--dim);margin:12px 0 5px}
input[type=text],input[type=password]{width:100%;padding:9px 11px;background:var(--bg);border:1px solid var(--border2);
  border-radius:6px;color:var(--text);font-size:14px;font-family:inherit}
input:focus{outline:none;border-color:var(--accent)}
.row{display:flex;gap:10px;align-items:flex-end}
.row>div{flex:1}
button{font-family:inherit;font-size:14px;font-weight:500;border-radius:6px;cursor:pointer;padding:9px 16px;border:1px solid var(--border2);background:var(--surface2);color:var(--text)}
button:hover{background:var(--border)}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
button.primary:hover{background:var(--accent2)}
button:disabled{opacity:.5;cursor:default}
.status{margin-top:12px;font-size:13px;min-height:18px}
.status.ok{color:var(--ok)}.status.err{color:var(--err)}.status.wait{color:var(--muted)}
.feat{display:flex;gap:12px;padding:12px 0;border-top:1px solid var(--border)}
.feat:first-of-type{border-top:0}
.feat input{margin-top:3px;width:17px;height:17px;flex-shrink:0;accent-color:var(--accent)}
.feat .ft{font-weight:600;font-size:13.5px}
.feat .fd{color:var(--dim);font-size:12.5px;margin-top:2px}
.feat .fi{color:var(--muted);font-size:12px;margin-top:5px}
.feat .fi b{color:var(--dim);font-weight:600}
.saverow{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:4px}
.whoami{color:var(--dim);font-size:12.5px}
.whoami b{color:var(--text)}
code{background:var(--surface2);padding:1px 5px;border-radius:4px;font-size:12px}
</style></head>
<body><div class="wrap">
  <h1>${appName}</h1>
  <div class="sub">Configuration du client — connecte ton compte ARCHI et choisis ce que tu partages.</div>

  <div class="card">
    <h2>Connexion ARCHI</h2>
    <div class="hint">Les mêmes identifiants que sur le site. Le mot de passe reste sur ton PC (dans <code>config.json</code>).</div>
    <div class="row">
      <div><label class="f" for="u">Identifiant</label><input id="u" type="text" autocomplete="username" placeholder="ton pseudo ARCHI"></div>
      <div><label class="f" for="p">Mot de passe</label><input id="p" type="password" autocomplete="current-password" placeholder="••••••••"></div>
    </div>
    <div style="margin-top:12px"><button id="test">Tester la connexion</button></div>
    <div class="status" id="st-login"></div>
  </div>

  <div class="card">
    <h2>Ce que ${appName} partage</h2>
    <div class="hint">Coche uniquement ce que tu veux. Tu peux revenir ici à tout moment.</div>
    <label class="feat"><input type="checkbox" id="f-rank" checked>
      <div><div class="ft">Rang & winrate SoloQ</div>
        <div class="fd">Fait remonter ton elo (tier, division, LP) et ton winrate sur ARCHI.</div>
        <div class="fi"><b>Impact :</b> quasi nul — une petite requête toutes les 5 min quand League est ouvert.</div></div></label>
    <label class="feat"><input type="checkbox" id="f-soloq" checked>
      <div><div class="ft">Historique & suivi SoloQ (+ replays .rofl)</div>
        <div class="fd">Historique de ton rang dans le temps, dernières parties classées, et lecture des replays .rofl.</div>
        <div class="fi"><b>Impact :</b> léger — surveillance du dossier des replays (par événement) ; l'analyse d'un replay est brève.</div></div></label>
    <label class="feat"><input type="checkbox" id="f-wiki">
      <div><div class="ft">Participer au wiki ARCHI</div>
        <div class="fd">Partage les données de champions/sorts lues dans ton client installé, pour alimenter le wiki de l'équipe.</div>
        <div class="fi"><b>Impact :</b> ponctuel — une extraction au lancement (ou au changement de patch), puis plus rien.</div></div></label>
  </div>

  <div class="card">
    <div class="saverow">
      <div class="whoami" id="who">Teste d'abord ta connexion.</div>
      <button class="primary" id="save" disabled>Enregistrer</button>
    </div>
    <div class="status" id="st-save"></div>
  </div>
</div>
<script>
const $=id=>document.getElementById(id);
let detected={playerId:'',name:''};
async function api(path,opts){ const r=await fetch(path,opts); return r.json(); }
(async()=>{ try{ const c=await api('/api/config'); $('u').value=c.username||''; detected.playerId=c.playerId||'';
  $('f-rank').checked=c.features.rank; $('f-soloq').checked=c.features.soloq; $('f-wiki').checked=c.features.wiki;
}catch(e){} })();

$('test').addEventListener('click', async ()=>{
  const u=$('u').value.trim(), p=$('p').value;
  if(!u||!p){ setLogin('err','Renseigne identifiant et mot de passe.'); return; }
  setLogin('wait','Connexion à ARCHI…'); $('test').disabled=true;
  const r=await api('/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
  $('test').disabled=false;
  if(!r.ok){ setLogin('err','✕ '+(r.error||'Échec.')); $('save').disabled=true; return; }
  detected.playerId = r.playerId||detected.playerId; detected.name=r.name||'';
  setLogin('ok','✓ Connecté'+(r.name?' en tant que '+r.name:'')+'.');
  const pid = detected.playerId;
  $('who').innerHTML = pid ? 'Compte lié au joueur <b>'+pid+'</b>.' :
    'Aucun joueur lié à ce compte. <b>Un admin</b> doit le lier dans « Comptes », sinon l\\'envoi sera refusé.';
  $('save').disabled = !pid && !(r.role==='admin');
  if(!pid && r.role==='admin'){ $('who').innerHTML='Compte admin — précise l\\'identifiant joueur à alimenter :'+
    ' <input id="pidIn" type="text" placeholder="ex. haito" style="width:140px;margin-left:6px">';
    const el=$('pidIn'); el.addEventListener('input',()=>{ detected.playerId=el.value.trim(); $('save').disabled=!detected.playerId; }); }
});

$('save').addEventListener('click', async ()=>{
  const body={ username:$('u').value.trim(), password:$('p').value, playerId:detected.playerId,
    features:{ rank:$('f-rank').checked, soloq:$('f-soloq').checked, wiki:$('f-wiki').checked } };
  setSave('wait','Enregistrement…'); $('save').disabled=true;
  const r=await api('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  $('save').disabled=false;
  if(r.ok) setSave('ok','✓ Enregistré. ${appName} applique tes choix. Tu peux fermer cette fenêtre.');
  else setSave('err','✕ '+(r.error||'Échec.'));
});
function setLogin(c,t){ const e=$('st-login'); e.className='status '+c; e.textContent=t; }
function setSave(c,t){ const e=$('st-save'); e.className='status '+c; e.textContent=t; }
</script>
</body></html>`;
};
