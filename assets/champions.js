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
  const LS = 'pz_champs_v1';
  // `version` = dernier patch ; `versionAlt` = patch précédent, utilisé en
  // secours car Data Dragon liste parfois un nouveau patch AVANT que ses images
  // ne soient disponibles sur le CDN (toutes les icônes renvoient alors 404).
  let version = '', versionAlt = '', list = [], byId = {};

  function index() { byId = {}; list.forEach(c => (byId[c.id] = c)); }

  async function load() {
    // Cache local d'abord (affichage instantané hors-ligne)
    try {
      const c = JSON.parse(localStorage.getItem(LS) || 'null');
      if (c && c.version && c.list) { version = c.version; versionAlt = c.versionAlt || ''; list = c.list; index(); }
    } catch (e) {}
    // Rafraîchit depuis Data Dragon
    try {
      const versions = await fetch(VERSIONS).then(r => r.json());
      const v = versions[0];
      versionAlt = versions[1] || versionAlt || v;
      if (v !== version || !list.length) {
        const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/fr_FR/champion.json`).then(r => r.json());
        version = v;
        list = Object.values(data.data).map(c => ({ id: c.id, name: c.name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        index();
      }
      try { localStorage.setItem(LS, JSON.stringify({ version, versionAlt, list })); } catch (e) {}
    } catch (e) {
      console.warn('Champions : Data Dragon indisponible, saisie manuelle possible.', e);
    }
  }

  const urlFor = (ver, id) => `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${id}.png`;
  const iconUrl = id => (version && id && byId[id]) ? urlFor(version, id) : '';
  const nameOf = id => (byId[id] && byId[id].name) || id || '';

  // Secours d'image : essaie le patch précédent, puis retombe sur les initiales.
  function imgFallback(img, id) {
    if (!img) return;
    if (!img._triedAlt && versionAlt && versionAlt !== version && id) {
      img._triedAlt = true; img.src = urlFor(versionAlt, id); return;
    }
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
