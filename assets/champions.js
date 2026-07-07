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
  let version = '', list = [], byId = {};

  function index() { byId = {}; list.forEach(c => (byId[c.id] = c)); }

  async function load() {
    // Cache local d'abord (affichage instantané hors-ligne)
    try {
      const c = JSON.parse(localStorage.getItem(LS) || 'null');
      if (c && c.version && c.list) { version = c.version; list = c.list; index(); }
    } catch (e) {}
    // Rafraîchit depuis Data Dragon
    try {
      const versions = await fetch(VERSIONS).then(r => r.json());
      const v = versions[0];
      if (v !== version || !list.length) {
        const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/fr_FR/champion.json`).then(r => r.json());
        version = v;
        list = Object.values(data.data).map(c => ({ id: c.id, name: c.name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        index();
        try { localStorage.setItem(LS, JSON.stringify({ version, list })); } catch (e) {}
      }
    } catch (e) {
      console.warn('Champions : Data Dragon indisponible, saisie manuelle possible.', e);
    }
  }

  const iconUrl = id => (version && id && byId[id]) ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png` : '';
  const nameOf = id => (byId[id] && byId[id].name) || id || '';

  function chipHtml(id, opts) {
    opts = opts || {};
    const u = iconUrl(id);
    return `<span class="champ-chip" data-champ="${id}">${u ? `<img src="${u}" alt="" loading="lazy">` : ''}<span>${nameOf(id)}</span>${opts.removable ? '<span class="x" title="Retirer">✕</span>' : ''}</span>`;
  }

  // ---- Modale de sélection ----
  let overlay, grid, search, cb = null;
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
    grid.innerHTML = items.map(c =>
      `<button type="button" class="champ-tile" data-id="${c.id}">
        <img src="${iconUrl(c.id)}" alt="" loading="lazy"><span>${c.name}</span>
      </button>`).join('');
    grid.querySelectorAll('.champ-tile').forEach(t => t.addEventListener('click', () => pick(t.dataset.id)));
  }
  function open(callback) {
    ensureModal(); cb = callback; search.value = ''; renderGrid('');
    overlay.classList.add('open'); setTimeout(() => search.focus(), 30);
  }
  function close() { if (overlay) overlay.classList.remove('open'); cb = null; }
  function pick(id) { const c = cb; close(); if (c) c(id); }

  const ready = load();
  window.Champions = { ready, iconUrl, nameOf, chipHtml, open,
    get version() { return version; }, get list() { return list; } };
})();
