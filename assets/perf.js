/* ============================================================
   ARCHI — Moteur de fiche de performance joueur
   Rendu piloté par window.PZ_PLAYER :
     { docId, pseudo, emoji, roleLabel, roleVar, cats:[{label,color,items:[{id,l,h}]}] }
   Les données Firestore restent au format historique
   (f_eval, t_forces, t_faib, t_obs, o1..o3, jV{}).
   ============================================================ */
(function () {
  'use strict';
  const P = window.PZ_PLAYER;
  if (!P) { console.error('PZ_PLAYER manquant'); return; }

  const QUAL = ['—','Très insuffisant','Insuffisant','Insuffisant','Passable','Moyen',
                'Correct','Bon','Très bon','Excellent','Exceptionnel'];

  const jV = {};
  P.cats.forEach(c => c.items.forEach(i => { jV[i.id] = 0; }));

  const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  // ---- Structure de page ----
  const root = document.getElementById('sheet');
  root.className = 'card';
  root.style.setProperty('--role', P.roleVar);
  root.innerHTML = `
    <div class="perf-head" style="--role:${P.roleVar}">
      <div>
        <div class="eyebrow">PlaZma Esport · Fiche de performance</div>
        <div class="doc-type">${P.roleLabel}</div>
      </div>
      <div class="perf-player">
        <div class="perf-emo">${P.emoji}</div>
        <div class="perf-player-info">
          <div class="perf-pseudo" style="color:${P.roleVar}">${esc(P.pseudo)}</div>
          <span class="role-badge" style="--role:${P.roleVar}">${P.roleShort || P.roleLabel}</span>
        </div>
      </div>
    </div>

    <div class="perf-meta">
      <label>Évaluateur</label>
      <input id="f_eval" type="text" placeholder="Coach / Manager">
    </div>

    <div class="score-band">
      <div>
        <div style="display:flex;align-items:baseline;gap:6px">
          <span class="score-num" id="scoreNum" style="color:${P.roleVar}">—</span>
          <span class="score-denom">/ 10</span>
        </div>
        <div class="score-lbl">Score global</div>
      </div>
      <div class="score-right">
        <div class="score-qual" id="scoreQual" style="color:${P.roleVar}">Non évalué</div>
        <div class="score-track"><div class="score-fill" id="scoreFill" style="background:${P.roleVar}"></div></div>
        <div class="cat-pills" id="catPills"></div>
      </div>
    </div>

    <div class="perf-body">
      <div>
        <div class="perf-sec-title"><span class="d" style="background:${P.roleVar}"></span>Évaluation des compétences (0 – 10)</div>
        <div id="jauges"></div>
      </div>
      <div>
        <div class="perf-sec-title"><span class="d" style="background:${P.roleVar}"></span>Analyse qualitative</div>
        <div class="obs-grid">
          <div class="obs-card" style="--oc:var(--ok)"><div class="obs-lbl">✦ Forces identifiées</div>
            <textarea id="t_forces" placeholder="2 à 3 forces avec exemples concrets…"></textarea></div>
          <div class="obs-card" style="--oc:var(--err)"><div class="obs-lbl">✦ Points à améliorer</div>
            <textarea id="t_faib" placeholder="Axes de progression, avec exemples…"></textarea></div>
        </div>
        <div class="obs-card" style="--oc:var(--accent)"><div class="obs-lbl">✦ Observations générales</div>
          <textarea id="t_obs" placeholder="Comportement in-game, communication, régularité, attitude en match…"></textarea></div>
      </div>
      <div>
        <div class="perf-sec-title"><span class="d" style="background:${P.roleVar}"></span>Objectifs pour la prochaine période</div>
        <div class="obj-row"><span class="obj-n">01</span><input id="o1" type="text" placeholder="Objectif 1"></div>
        <div class="obj-row"><span class="obj-n">02</span><input id="o2" type="text" placeholder="Objectif 2"></div>
        <div class="obj-row"><span class="obj-n">03</span><input id="o3" type="text" placeholder="Objectif 3"></div>
      </div>
    </div>

    <div class="perf-foot">
      <div class="brand">PlaZma Esport · ARCHI · plazma-esport.fr</div>
      <div class="sigs">
        <div class="sig"><div class="sig-line"></div><div class="sig-lbl">Coach</div></div>
        <div class="sig"><div class="sig-line"></div><div class="sig-lbl">Joueur</div></div>
      </div>
    </div>`;

  // ---- Jauges ----
  const jaugesEl = document.getElementById('jauges');
  P.cats.forEach(cat => {
    const block = document.createElement('div');
    block.className = 'cat-block';
    block.innerHTML = `<div class="cat-label" style="--cc:${cat.color}">${cat.label}</div>`;
    const list = document.createElement('div');
    list.className = 'jauge-list';
    cat.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'jr';
      row.style.setProperty('--jc', cat.color);
      row.innerHTML = `<div class="jr-label"><strong>${item.l}</strong><span>${item.h}</span></div>
        <div class="jr-dots" id="jd_${item.id}"></div>
        <div class="jr-num" id="jn_${item.id}">0</div>`;
      const dots = row.querySelector('.jr-dots');
      for (let i = 1; i <= 10; i++) {
        const d = document.createElement('div');
        d.className = 'jd'; d.style.background = cat.color; d.dataset.n = i;
        d.addEventListener('click', () => {
          jV[item.id] = jV[item.id] === i ? 0 : i;
          refresh(item.id, cat.color); updateScore(); queueSave();
        });
        dots.appendChild(d);
      }
      list.appendChild(row);
    });
    block.appendChild(list);
    jaugesEl.appendChild(block);
  });

  function refresh(id, col) {
    const v = jV[id] || 0;
    document.querySelectorAll('#jd_' + id + ' .jd').forEach(d => d.classList.toggle('on', +d.dataset.n <= v));
    const n = document.getElementById('jn_' + id);
    if (n) { n.textContent = v; n.style.color = v > 0 ? col : 'var(--muted)'; }
  }

  function updateScore() {
    const pills = document.getElementById('catPills');
    pills.innerHTML = '';
    const catAvgs = [];
    P.cats.forEach(cat => {
      const vals = cat.items.map(i => jV[i.id] || 0).filter(v => v > 0);
      if (!vals.length) return;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      catAvgs.push(avg);
      const p = document.createElement('span');
      p.className = 'cp';
      p.style.cssText = `background:${cat.color}22;color:${cat.color}`;
      p.textContent = cat.label.split(' ')[0] + ' ' + avg.toFixed(1);
      pills.appendChild(p);
    });
    const g = catAvgs.length ? catAvgs.reduce((a, b) => a + b, 0) / catAvgs.length : 0;
    const col = g >= 8 ? 'var(--ok)' : g >= 6 ? P.roleVar : g >= 4 ? 'var(--warn)' : g > 0 ? 'var(--err)' : P.roleVar;
    const sn = document.getElementById('scoreNum');
    const sq = document.getElementById('scoreQual');
    const sf = document.getElementById('scoreFill');
    sn.textContent = g > 0 ? (Math.round(g * 10) / 10).toFixed(1) : '—';
    sn.style.color = col; sq.textContent = QUAL[Math.round(g)] || '—'; sq.style.color = col;
    sf.style.width = (g / 10 * 100) + '%'; sf.style.background = col;
  }

  // ---- État ----
  const val = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ''; };
  const FIELDS = ['f_eval','t_forces','t_faib','t_obs','o1','o2','o3'];

  function getState() {
    const s = { jV: { ...jV } };
    FIELDS.forEach(f => s[f] = val(f));
    return s;
  }
  function applyState(s) {
    if (!s) return;
    FIELDS.forEach(f => { if (document.activeElement !== document.getElementById(f)) set(f, s[f]); });
    if (s.jV) {
      Object.keys(jV).forEach(k => { jV[k] = s.jV[k] || 0; });
      P.cats.forEach(cat => cat.items.forEach(i => refresh(i.id, cat.color)));
    }
    updateScore();
  }

  // ---- Sync ----
  const sync = PZ.sync({ docId: P.docId, getState, applyState });
  let timer = null;
  function queueSave() { clearTimeout(timer); timer = setTimeout(() => sync.save(), 800); }
  document.querySelectorAll('#f_eval,#t_forces,#t_faib,#t_obs,#o1,#o2,#o3')
    .forEach(el => el.addEventListener('input', queueSave));

  // ---- Barre d'outils ----
  document.getElementById('btnExport').addEventListener('click', () => PZ.exportPNG(root, 'archi-' + P.docId));
  document.getElementById('btnBackup').addEventListener('click', () => PZ.backup(getState(), 'archi-' + P.docId));
  document.getElementById('btnImport').addEventListener('click', () => PZ.importFile(d => { applyState(d); sync.save(); }));
  document.getElementById('btnReset').addEventListener('click', () => {
    if (!confirm('Réinitialiser la fiche de ' + P.pseudo + ' ?')) return;
    Object.keys(jV).forEach(k => jV[k] = 0);
    P.cats.forEach(cat => cat.items.forEach(i => refresh(i.id, cat.color)));
    FIELDS.forEach(f => set(f, '')); updateScore(); sync.reset();
  });

  updateScore();
})();
