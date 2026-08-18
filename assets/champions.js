/* ============================================================
   ARCHI — Sélecteur de champions League of Legends
   Basé sur Riot Data Dragon (CDN statique, sans clé API).
   Fournit une liste + des icônes, et une modale de sélection.

   API :
     Champions.ready        Promise résolue quand la liste est chargée
     Champions.iconUrl(id)  URL de l'icône carrée du champion
     Champions.nameOf(id)   Nom localisé (ou l'id en secours)
     Champions.open(cb)     Ouvre la modale ; cb(id) avec l'id choisi
                            (ou une chaîne libre si Data Dragon est indispo)
     Champions.chipHtml(id, {removable, onRemove})  HTML d'une puce champion
   ============================================================ */
(function () {
  'use strict';
  const VERSIONS = 'https://ddragon.leagueoflegends.com/api/versions.json';
  // Icônes hébergées dans le repo (assets/champions/), rafraîchies chaque jour
  // par une GitHub Action. Source PRINCIPALE : rapide, même origine, insensible
  // à une panne de Data Dragon.
  const MANIFEST = 'assets/champions/manifest.json';
  const localIcon = id => new URL('assets/champions/' + id + '.png', document.baseURI).href;
  // Community Dragon : miroir indépendant (autre domaine/CDN), secours ultime.
  const CD_SUMMARY = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json';
  const CD_ICON = key => key ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${key}.png` : '';
  const LS = 'pz_champs_v1';
  // `version` = dernier patch ; `versionAlt` = patch précédent (secours images).
  let version = '', versionAlt = '', list = [], byId = {};

  function index() { byId = {}; list.forEach(c => (byId[c.id] = c)); }
  const hasKeys = () => list.length && list[0] && list[0].key;
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
  const mergeInto = extra => {   // ajoute les champions absents + complète les clés
    const known = new Set(list.map(x => x.id));
    extra.forEach(x => { if (!known.has(x.id)) list.push(x); });
    const kmap = {}; extra.forEach(x => { if (x.key) kmap[x.id] = x.key; });
    list.forEach(x => { if (!x.key && kmap[x.id]) x.key = kmap[x.id]; });
    list.sort(byName);
  };

  async function load() {
    // Cache local (affichage instantané au rechargement)
    try {
      const c = JSON.parse(localStorage.getItem(LS) || 'null');
      if (c && c.list) { version = c.version || ''; versionAlt = c.versionAlt || ''; list = c.list; index(); }
    } catch (e) {}
    // 0) Manifeste local (icônes du repo) — prioritaire et hors-ligne.
    try {
      const m = await fetch(MANIFEST, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null);
      if (m && Array.isArray(m.champions) && m.champions.length) {
        list = m.champions.map(c => ({ id: c.id, name: c.name, key: String(c.key || ''), local: true })).sort(byName);
        index();
      }
    } catch (e) {}
    // 1) Data Dragon : versions (secours) + rafraîchit la liste si le patch change
    //    (ou si on n'a pas encore de liste/clés).
    try {
      const versions = await fetch(VERSIONS).then(r => r.json());
      const v = versions[0];
      versionAlt = versions[1] || versionAlt || v;
      if (v !== version || !hasKeys() || !list.length) {
        const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/fr_FR/champion.json`).then(r => r.json());
        version = v;
        const dd = Object.values(data.data).map(c => ({ id: c.id, name: c.name, key: c.key })).sort(byName);
        if (list.length) mergeInto(dd); else { list = dd; }
        index();
      }
      try { localStorage.setItem(LS, JSON.stringify({ version, versionAlt, list })); } catch (e) {}
    } catch (e) {
      console.warn('Champions : Data Dragon indisponible.', e);
    }
    // 2) Filet Community Dragon : garantit noms + clés même si tout ddragon tombe.
    if (!list.length || !hasKeys()) {
      try {
        const sum = await fetch(CD_SUMMARY).then(r => r.json());
        const arr = sum.filter(c => c && c.id > 0).map(c => ({ id: c.alias, name: c.name, key: String(c.id) })).sort(byName);
        if (arr.length) { if (list.length) mergeInto(arr); else list = arr; index(); try { localStorage.setItem(LS, JSON.stringify({ version, versionAlt, list })); } catch (e) {} }
      } catch (e) {
        console.warn('Champions : Community Dragon indisponible aussi.', e);
      }
    }
  }

  const urlFor = (ver, id) => `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${id}.png`;
  // Sources d'icône, dans l'ordre de préférence : local → ddragon → patch
  // précédent → Community Dragon. imgFallback les essaie une à une.
  function candidates(id) {
    const c = byId[id] || {}; const out = [];
    if (c.local) out.push(localIcon(id));
    if (version && id) out.push(urlFor(version, id));
    if (versionAlt && versionAlt !== version && id) out.push(urlFor(versionAlt, id));
    if (c.key) out.push(CD_ICON(c.key));
    return out;
  }
  const iconUrl = id => { if (!byId[id] || !id) return ''; return candidates(id)[0] || ''; };
  const nameOf = id => (byId[id] && byId[id].name) || id || '';

  // Secours d'image en cascade — ne laisse jamais une image cassée à l'écran.
  function imgFallback(img, id) {
    if (!img) return;
    img._tried = img._tried || {};
    if (img.src) img._tried[img.src] = 1;   // marque l'URL qui vient d'échouer
    const next = candidates(id).find(u => !img._tried[u]);
    if (next) { img._tried[next] = 1; img.src = next; return; }
    img.onerror = null;
    const span = document.createElement('span');
    const name = nameOf(id);
    span.textContent = name ? name.slice(0, 4) : '?';
    span.title = name;
    span.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:10px;font-weight:700;color:var(--muted,#8b90a0);text-align:center;padding:2px;line-height:1.1;box-sizing:border-box';
    if (img.parentNode) img.parentNode.replaceChild(span, img);
  }

  function chipHtml(id, opts) {
    opts = opts || {};
    const u = iconUrl(id);
    return `<span class="champ-chip" data-champ="${id}">${u ? `<img src="${u}" alt="" loading="lazy" onerror="Champions.imgFallback(this,'${id}')">` : ''}<span>${nameOf(id)}</span>${opts.removable ? '<span class="x" title="Retirer">✕</span>' : ''}</span>`;
  }

  // ---- Modale de sélection ----
  let overlay, grid, search, cb = null, excludeSet = new Set();
  function ensureModal() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'champ-overlay';
    overlay.innerHTML = `
      <div class="champ-modal">
        <div class="champ-modal-head">
          <input class="champ-search" placeholder="Rechercher un champion…" autocomplete="off">
          <button class="champ-close" title="Fermer">✕</button>
        </div>
        <div class="champ-grid"></div>
        <div class="champ-foot">Entrée = valider le texte saisi (si le champion n'est pas trouvé)</div>
      </div>`;
    document.body.appendChild(overlay);
    grid = overlay.querySelector('.champ-grid');
    search = overlay.querySelector('.champ-search');
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.champ-close').addEventListener('click', close);
    search.addEventListener('input', () => renderGrid(search.value));
    search.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') {
        const q = search.value.trim();
        const first = filtered(q)[0];
        if (first) pick(first.id);
        else if (q) pick(q); // secours : texte libre
      }
    });
  }
  function filtered(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }
  function renderGrid(q) {
    const items = filtered(q).slice(0, 300);
    if (!list.length) {
      grid.innerHTML = `<div class="champ-empty">Liste des champions indisponible (hors-ligne).<br>Tape un nom puis Entrée pour l'ajouter en texte.</div>`;
      return;
    }
    grid.innerHTML = items.map(c => {
      const used = excludeSet.has(c.id);
      return `<button type="button" class="champ-tile${used?' used':''}" data-id="${c.id}"${used?' disabled':''}>
        <img src="${iconUrl(c.id)}" alt="" loading="lazy" onerror="Champions.imgFallback(this,'${c.id}')"><span>${c.name}</span>
      </button>`;
    }).join('');
    grid.querySelectorAll('.champ-tile:not(.used)').forEach(t => t.addEventListener('click', () => pick(t.dataset.id)));
  }
  function open(callback, opts) {
    opts = opts || {};
    excludeSet = new Set(opts.exclude || []);
    ensureModal(); cb = callback; search.value = ''; renderGrid('');
    overlay.classList.add('open'); setTimeout(() => search.focus(), 30);
  }
  function close() { if (overlay) overlay.classList.remove('open'); cb = null; }
  function pick(id) { const c = cb; close(); if (c) c(id); }

  const ready = load();
  window.Champions = { ready, iconUrl, nameOf, chipHtml, open, imgFallback,
    get version() { return version; }, get versionAlt() { return versionAlt; }, get list() { return list; } };
})();
