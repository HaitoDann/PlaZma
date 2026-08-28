/* ============================================================
   ARCHI — Infrastructure partagée (PlaZma Esport)
   Centralise : config Firebase, garde d'accès, navigation,
   synchronisation Firestore, export PNG, sauvegarde/import.

   Inclusion type dans une page :
     <script src=".../firebase-app-compat.js"></script>
     <script src=".../firebase-firestore-compat.js"></script>
     <script src="assets/plazma.js"></script>
   Pour une page publique (ex: formulaire joueur) :
     <script src="assets/plazma.js" data-public></script>
   ============================================================ */
(function () {
  'use strict';

  // ---- Config Firebase (une seule source de vérité) ----
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyAKwNEbNa6f40oSMwGp6dcDY1ZY6hUN1Ks',
    authDomain: 'plazma-esport.firebaseapp.com',
    projectId: 'plazma-esport',
    storageBucket: 'plazma-esport.firebasestorage.app',
    messagingSenderId: '534325929279',
    appId: '1:534325929279:web:b507a46c601fa6625edf8a'
  };

  // Collection Firestore principale
  const COLLECTION = 'plazma';

  // Domaine interne pour l'auth par nom d'utilisateur (style GLPI).
  // On se connecte avec un pseudo ; en interne Firebase reçoit
  // "<pseudo>@archi.local" (aucun e-mail réel n'est utilisé).
  // ⚠️ Doit rester identique dans login.html et plazma-admin.html.
  const USER_DOMAIN = 'archi.local';

  const script = document.currentScript;
  const isPublic = script && script.hasAttribute('data-public');
  // Compartiment requis pour afficher la page (ex: data-section="scouting").
  const pageSection = script ? script.getAttribute('data-section') : null;
  const page = location.pathname.split('/').pop() || 'index.html';
  const NEEDS_AUTH = !isPublic && page !== 'login.html';

  // ---- Init Firebase (app + Firestore + Auth) ----
  // Robuste à un chargement partiel du SDK : PZ doit toujours être défini.
  let db = null, auth = null;
  try {
    if (window.firebase && typeof firebase.initializeApp === 'function') {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      if (typeof firebase.firestore === 'function') db = firebase.firestore();
      if (typeof firebase.auth === 'function') auth = firebase.auth();
    }
  } catch (e) {
    console.error('Firebase indisponible :', e);
  }

  // ============ Authentification & contrôle d'accès ============
  // La protection RÉELLE vient des règles de sécurité Firestore (firestore.rules).
  // Ce module gère la connexion, le profil de l'utilisateur et l'affichage
  // (redirection login, masquage des modules non autorisés).
  const SECTION_KEYS = ['planning', 'scrim', 'scouting', 'team', 'dashboard', 'coach', 'satisfaction', 'satisfactionResults', 'perf'];
  let authUser = null;   // { uid, email }
  let profile = null;    // { name, role, sections:{}, disabled }
  let authResolved = false;
  const authListeners = [];
  let _resolveReady;
  const authReadyPromise = new Promise(r => (_resolveReady = r));

  const isAdmin = () => !!profile && profile.role === 'admin' && !profile.disabled;
  // Niveau d'accès à un module : 'edit' | 'view' | null.
  // Rétrocompat : une valeur `true` (ancien modèle) vaut 'edit'.
  function accessLevel(section) {
    if (!profile || profile.disabled) return null;
    if (profile.role === 'admin') return 'edit';
    const v = profile.sections && profile.sections[section];
    if (v === true || v === 'edit') return 'edit';
    if (v === 'view') return 'view';
    return null;
  }
  const canRead = section => { const l = accessLevel(section); return l === 'edit' || l === 'view'; };
  const canWrite = section => accessLevel(section) === 'edit';
  const can = canRead;   // "can" = lecture (voir OU modifier) — nav, garde de page
  function onAuth(cb) { authListeners.push(cb); if (authResolved) { try { cb(authUser, profile); } catch (e) { console.error(e); } } }
  function notifyAuth() { authListeners.forEach(cb => { try { cb(authUser, profile); } catch (e) { console.error(e); } }); }

  // ---- Overlay plein écran : évite tout flash de contenu protégé ----
  let gateEl = null;
  function gate(html) {
    if (!gateEl) {
      gateEl = document.createElement('div');
      gateEl.id = 'pz-authgate';
      gateEl.setAttribute('style',
        'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
        'background:var(--bg,#0d0f14);color:var(--text,#e7e9ee);padding:24px;text-align:center;' +
        "font-family:var(--font,system-ui),sans-serif");
      (document.body || document.documentElement).appendChild(gateEl);
    }
    gateEl.innerHTML = html || '';
    gateEl.style.display = 'flex';
  }
  function ungate() { if (gateEl) gateEl.style.display = 'none'; }
  const spinnerHtml =
    '<div><div style="width:34px;height:34px;border:3px solid rgba(128,128,128,.25);border-top-color:var(--accent,#6ea8fe);border-radius:50%;margin:0 auto 14px;animation:pzspin .8s linear infinite"></div>' +
    '<div style="font-size:13px;color:var(--muted,#8b90a0)">Vérification de l\'accès…</div></div>' +
    '<style>@keyframes pzspin{to{transform:rotate(360deg)}}</style>';
  function deniedHtml(msg) {
    return '<div style="max-width:420px"><div style="font-size:40px;margin-bottom:10px">🔒</div>' +
      '<h2 style="font-family:var(--font-display,inherit);margin:0 0 8px">Accès restreint</h2>' +
      '<p style="color:var(--muted,#8b90a0);font-size:14px;line-height:1.5;margin:0 0 20px">' + msg + '</p>' +
      '<div style="display:flex;gap:10px;justify-content:center">' +
      '<a href="index.html" style="padding:9px 16px;border-radius:9px;background:var(--card,#171a22);color:var(--text,#e7e9ee);text-decoration:none;font-size:13px;font-weight:600">Accueil</a>' +
      '<button onclick="PZ.logout()" style="padding:9px 16px;border-radius:9px;background:var(--accent,#6ea8fe);color:#06101f;border:0;font-size:13px;font-weight:700;cursor:pointer">Se déconnecter</button>' +
      '</div></div>';
  }

  function handleAccess() {
    if (!NEEDS_AUTH) { refreshNav(); return; }
    if (!authUser) { location.replace('login.html'); return; }
    if (!profile || profile.disabled) {
      gate(deniedHtml("Ton compte n'a pas encore d'accès à ARCHI (ou il a été désactivé). Contacte un administrateur."));
      return;
    }
    if (page === 'plazma-admin.html' && !isAdmin()) { gate(deniedHtml('Cet espace est réservé aux administrateurs.')); return; }
    if (pageSection && !can(pageSection)) { gate(deniedHtml("Tu n'as pas accès à ce module. Demande l'accès à un administrateur.")); return; }
    ungate();
    refreshNav();
    if (pageSection && accessLevel(pageSection) === 'view') { showReadOnlyBanner(); applyReadOnly(); }
  }
  // Mode lecture seule générique : verrouille la saisie de texte/nombre et masque
  // les commandes d'édition marquées [data-edit]. Couvre le contenu rendu dynamiquement
  // (MutationObserver). Les contrôles de lecture (recherche, filtres) peuvent porter
  // l'attribut data-ro-keep pour rester actifs.
  function applyReadOnly() {
    const lock = root => {
      if (!root || root.nodeType !== 1) return;
      if (root.matches && root.matches('[data-edit]')) root.style.display = 'none';
      if (root.querySelectorAll) {
        root.querySelectorAll('[data-edit]').forEach(el => { el.style.display = 'none'; });
        root.querySelectorAll('textarea:not([data-ro-keep]), input[type="text"]:not([data-ro-keep]), input[type="number"]:not([data-ro-keep]), input:not([type]):not([data-ro-keep])')
          .forEach(el => { el.readOnly = true; });
      }
    };
    lock(document.body);
    try { new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(lock))).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }
  function showReadOnlyBanner() {
    if (document.getElementById('pz-ro-banner')) return;
    const b = document.createElement('div');
    b.id = 'pz-ro-banner';
    b.setAttribute('style',
      'position:fixed;left:12px;bottom:12px;z-index:900;background:var(--warn,#e7a03a);color:#1a1205;' +
      'border-radius:8px;padding:7px 12px;font-family:var(--font,system-ui),sans-serif;font-size:12px;' +
      'font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.3)');
    b.textContent = '👁 Lecture seule — consultation autorisée, modification non.';
    document.body.appendChild(b);
  }

  // ---- Cache d'authentification (sessionStorage) ----
  // Affiche la page immédiatement depuis le cache, sans attendre Firebase.
  // Évite l'écran "Vérification de l'accès…" à chaque navigation.
  const _AUTH_CACHE_KEY = 'pz_auth_v1';
  const _AUTH_CACHE_TTL = 30 * 60 * 1000; // 30 min
  function _saveAuthCache() {
    if (!authUser || !profile || profile.disabled) return;
    try {
      sessionStorage.setItem(_AUTH_CACHE_KEY, JSON.stringify({
        uid: authUser.uid, email: authUser.email, profile, ts: Date.now()
      }));
    } catch (e) {}
  }
  function _loadAuthCache() {
    try {
      const raw = sessionStorage.getItem(_AUTH_CACHE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || Date.now() - d.ts > _AUTH_CACHE_TTL) { sessionStorage.removeItem(_AUTH_CACHE_KEY); return null; }
      return d;
    } catch (e) { return null; }
  }
  function _clearAuthCache() { try { sessionStorage.removeItem(_AUTH_CACHE_KEY); } catch (e) {} }

  function startAuth() {
    if (!auth) {
      authResolved = true; _resolveReady({ user: null, profile: null });
      if (NEEDS_AUTH) location.replace('login.html');
      return;
    }

    // Affichage immédiat depuis le cache — saute l'écran de vérification
    if (NEEDS_AUTH) {
      const cached = _loadAuthCache();
      if (cached) {
        authUser = { uid: cached.uid, email: cached.email };
        profile = cached.profile;
        handleAccess(); // dégate immédiatement si accès OK
      } else {
        gate(spinnerHtml);
      }
    }

    auth.onAuthStateChanged(async user => {
      authUser = user ? { uid: user.uid, email: user.email } : null;
      if (user && db) {
        try { const s = await db.collection('users').doc(user.uid).get(); profile = s.exists ? s.data() : null; }
        catch (e) { console.error('Chargement du profil impossible', e); profile = null; }
      } else { profile = null; _clearAuthCache(); }
      if (authUser && profile && !profile.disabled) _saveAuthCache();
      authResolved = true; _resolveReady({ user: authUser, profile });
      handleAccess();
      notifyAuth();
    });
  }

  // ---- Roster central (mercato : noms/emojis modifiables partout) ----
  // L'id, le rôle et la couleur restent fixes (code) ; seuls nom et emoji
  // sont surchargeables via le doc Firestore `roster`.
  const ROSTER_SLOTS = [
    { id:'boulou',  roleKey:'top',     role:'Top',     color:'var(--top)',     defaultName:'Boulou',  defaultEmoji:'👍' },
    { id:'zugu',    roleKey:'jungle',  role:'Jungle',  color:'var(--jungle)',  defaultName:'Zugu',    defaultEmoji:'🕊️' },
    { id:'lakrael', roleKey:'mid',     role:'Mid',     color:'var(--mid)',     defaultName:'Lakraël', defaultEmoji:'👀' },
    { id:'ke1do',   roleKey:'adc',     role:'ADC',     color:'var(--adc)',     defaultName:'Ke1do',   defaultEmoji:'🐯' },
    { id:'sayro',   roleKey:'support', role:'Support', color:'var(--support)', defaultName:'Joordy',  defaultEmoji:'🥀' },
  ];
  const COACH_SLOT = { id:'coach', roleKey:'coach', role:'Head Coach', color:'var(--coach)', defaultName:'Coach', defaultEmoji:'♟️' };

  let rosterOverrides = {};            // { id: { name, emoji } }
  const rosterListeners = [];

  function resolveSlot(slot) {
    const o = rosterOverrides[slot.id] || {};
    return {
      id: slot.id, roleKey: slot.roleKey, role: slot.role, color: slot.color,
      name: (o.name && o.name.trim()) || slot.defaultName,
      emoji: (o.emoji && o.emoji.trim()) || slot.defaultEmoji
    };
  }
  const getRoster = () => ROSTER_SLOTS.map(resolveSlot);
  const getCoach = () => resolveSlot(COACH_SLOT);
  const player = id => getRoster().concat(getCoach()).find(p => p.id === id) || null;

  function notifyRoster() {
    const r = getRoster(), c = getCoach();
    rosterListeners.forEach(cb => { try { cb(r, c); } catch (e) { console.error(e); } });
  }
  /** Enregistre un callback (r, coach) appelé maintenant puis à chaque MAJ du roster. */
  function onRoster(cb) { rosterListeners.push(cb); cb(getRoster(), getCoach()); }
  function setPlayer(id, patch) { rosterOverrides[id] = Object.assign({}, rosterOverrides[id], patch); }
  function saveRoster() {
    if (!db) return Promise.resolve();
    return db.collection(COLLECTION).doc('roster').set(rosterOverrides);
  }

  if (db) {
    db.collection(COLLECTION).doc('roster').onSnapshot(
      doc => { rosterOverrides = (doc.exists && doc.data()) || {}; notifyRoster(); },
      e => console.error('roster', e)
    );
  }

  // ---- Navigation partagée ----
  const NAV = [
    { key: 'home',         href: 'index.html',              label: 'Accueil' },
    { key: 'schedule',     href: 'plazma-schedule.html',    label: 'Planning',     section: 'planning' },
    { key: 'scrim',        href: 'plazma-scrim.html',       label: 'Scrim',        section: 'scrim' },
    { key: 'scouting',     href: 'plazma-scouting.html',    label: 'Scouting',     section: 'scouting' },
    { key: 'draft',        href: 'plazma-draft.html',       label: 'Draft',        section: 'scouting' },
    { key: 'wiki',         href: 'plazma-wiki.html',        label: 'Wiki' },
    { key: 'team',         href: 'plazma-team.html',        label: 'Équipe',       section: 'team' },
    { key: 'dashboard',    href: 'plazma-dashboard.html',   label: 'Dashboard',    section: 'dashboard' },
    { key: 'coach',        href: 'plazma-coach.html',       label: 'Coach',        section: 'coach' },
    { key: 'satisfaction', href: 'plazma-satisfaction.html',label: 'Satisfaction', section: 'satisfaction' },
    { key: 'satisfaction-coach', href: 'plazma-satisfaction-coach.html', label: 'Satisf. Coach', section: 'satisfaction' }
  ];

  let _navActive = null, _navMount;
  /** Injecte la barre de navigation (filtrée selon les accès de l'utilisateur). */
  function mountNav(activeKey, mountSel) {
    _navActive = activeKey; _navMount = mountSel; renderNav();
  }
  /** Re-rend la nav quand le profil d'accès change (appelé après résolution auth). */
  function refreshNav() { if (_navActive !== null || _navMount !== undefined) renderNav(); }
  function renderNav() {
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let links = NAV.filter(n => !n.section || can(n.section))
      .map(n => `<a href="${n.href}"${n.key === _navActive ? ' class="active"' : ''}>${n.label}</a>`).join('');
    if (isAdmin()) links += `<a href="plazma-admin.html"${_navActive === 'admin' ? ' class="active"' : ''}>Comptes</a>`;
    const who = profile
      ? `<div class="pz-nav-right"><button class="pz-nav-user" type="button" onclick="PZ.changePassword()" title="Changer mon mot de passe">${esc(profile.name || profile.username || '')}</button>` +
        `<button class="pz-logout" type="button" onclick="PZ.logout()" title="Se déconnecter">⏻</button></div>`
      : '';
    const html =
      `<div class="pz-topbar"><div class="pz-topbar-inner">
        <a class="pz-brand" href="index.html">
          <span class="pz-brand-mark"><img src="assets/logo-plazma.png" alt="ARCHI"></span>
          <span><span class="pz-brand-name">ARCHI</span></span>
        </a>
        <nav class="pz-nav">${links}</nav>
        ${who}
      </div></div>`;
    const host = _navMount ? document.querySelector(_navMount) : null;
    if (host) { host.innerHTML = html; return; }
    const existing = document.querySelector('.pz-topbar');
    if (existing) existing.outerHTML = html;
    else document.body.insertAdjacentHTML('afterbegin', html);
  }

  // ---- Pastille de synchro ----
  // Attend des éléments #syncDot / #syncText / #syncTime si présents.
  function status(state, text, time) {
    const dot  = document.getElementById('syncDot');
    const txt  = document.getElementById('syncText');
    const tim  = document.getElementById('syncTime');
    const pill = dot && dot.closest('.sync-pill');
    if (dot) dot.className = 'sync-dot ' + state;
    if (txt) txt.textContent = text || '';
    if (tim) tim.textContent = time || '';
    // Flash vert discret quand la sauvegarde réussit
    if (state === 'connected' && pill) {
      pill.classList.remove('flash');
      requestAnimationFrame(() => pill.classList.add('flash'));
      pill.addEventListener('animationend', () => pill.classList.remove('flash'), { once: true });
    }
  }

  /** Renvoie un timestamp relatif en français.
   *  @param {Date|firebase.firestore.Timestamp|string} date
   */
  function relTime(date) {
    if (!date) return '';
    const d = date instanceof Date ? date
            : date.toDate ? date.toDate()
            : new Date(date);
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 45)      return 'À l\'instant';
    if (s < 3600)    return 'Il y a ' + Math.round(s / 60) + ' min';
    if (s < 7200)    return 'Il y a 1h';
    if (s < 86400)   return 'Il y a ' + Math.floor(s / 3600) + 'h';
    if (s < 172800)  return 'Hier';
    if (s < 604800)  return 'Il y a ' + Math.floor(s / 86400) + ' jours';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
  const nowTime = () =>
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  function loadingDone() {
    const el = document.querySelector('.loader');
    if (el) { el.classList.add('hidden'); setTimeout(() => (el.style.display = 'none'), 400); }
  }

  /**
   * Synchronise un document Firestore en temps réel.
   * @param {object} opts
   *   docId     : id du document (string ou fonction)
   *   getState  : () => objet à sauvegarder
   *   applyState: (data) => applique les données reçues
   *   onData    : (exists) => appelé après réception (pour re-render)
   * @returns { save, reset, stop, docId }
   */
  // Signature de contenu insensible à l'ordre des clés (Firestore réordonne) et
  // sans _savedAt : distingue l'écho de nos propres sauvegardes d'un vrai changement distant.
  function _sig(o) {
    const norm = v => {
      if (Array.isArray(v)) return v.map(norm);
      if (v && typeof v === 'object') { const r = {}; Object.keys(v).sort().forEach(k => { if (k !== '_savedAt') r[k] = norm(v[k]); }); return r; }
      return v;
    };
    return JSON.stringify(norm(o));
  }

  function sync(opts) {
    const { getState, applyState, onData } = opts;
    const resolveId = () =>
      (typeof opts.docId === 'function' ? opts.docId() : opts.docId);
    let unsub = null;
    let current = null;
    let lastSavedSig = null, suppressUntil = 0;   // garde anti-écho

    function start() {
      if (!db) { status('error', 'Firebase indisponible'); loadingDone(); return; }
      if (unsub) { unsub(); unsub = null; }
      current = resolveId();
      lastSavedSig = null; suppressUntil = 0;
      status('syncing', 'Connexion…');
      unsub = db.collection(COLLECTION).doc(current).onSnapshot(
        doc => {
          if (doc.metadata.hasPendingWrites) return;             // écriture optimiste locale
          if (!doc.exists) { status('connected', 'Vide', ''); onData && onData(false); loadingDone(); return; }
          // On ne reconstruit (applyState + re-render) que sur un VRAI changement distant,
          // jamais sur l'écho de nos propres sauvegardes → plus de sauts de curseur.
          const incoming = _sig(doc.data());
          const isEcho = incoming === lastSavedSig || Date.now() < suppressUntil;
          if (isEcho || (getState && incoming === _sig(getState()))) {
            status('connected', 'Synchronisé', nowTime()); loadingDone(); return;
          }
          applyState && applyState(doc.data());
          status('connected', 'Synchronisé', nowTime());
          onData && onData(true);
          loadingDone();
        },
        err => { console.error(err); status('error', 'Erreur de connexion'); loadingDone(); }
      );
    }

    function save() {
      if (!db) { status('error', 'Firebase indisponible'); return Promise.resolve(); }
      status('syncing', 'Sauvegarde…');
      const state = getState();
      lastSavedSig = _sig(state); suppressUntil = Date.now() + 3000;   // ignorer l'écho de cette écriture
      return db.collection(COLLECTION).doc(resolveId()).set(state)
        .then(() => status('connected', 'Synchronisé', nowTime()))
        .catch(e => { console.error(e); status('error', 'Erreur Firebase'); });
    }

    function reset(confirmMsg) {
      if (confirmMsg && !confirm(confirmMsg)) return;
      if (!db) return;
      db.collection(COLLECTION).doc(resolveId()).delete()
        .then(() => { status('connected', 'Réinitialisé', ''); onData && onData(false); });
    }

    start();
    return { save, reset, restart: start, stop: () => unsub && unsub(), docId: resolveId };
  }

  // ---- Export PNG (nécessite html2canvas sur la page) ----
  async function exportPNG(el, filename) {
    if (!window.html2canvas) { alert('Export indisponible'); return; }
    const hidden = [...document.querySelectorAll('[data-noexport]')];
    hidden.forEach(e => (e.style.visibility = 'hidden'));
    // Déplie les zones de texte à la hauteur de leur contenu (sinon html2canvas
    // rogne tout ce qui dépasse la boîte visible).
    const grown = [...el.querySelectorAll('textarea')].map(t => {
      const h = t.style.height, ov = t.style.overflow;
      t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; t.style.overflow = 'hidden';
      return { t, h, ov };
    });
    await new Promise(r => setTimeout(r, 60));
    const canvas = await html2canvas(el, {
      scale: 2, backgroundColor: getComputedStyle(document.body).backgroundColor,
      useCORS: true, logging: false
    });
    grown.forEach(({ t, h, ov }) => { t.style.height = h; t.style.overflow = ov; });
    hidden.forEach(e => (e.style.visibility = ''));
    const a = document.createElement('a');
    a.download = (filename || 'archi') + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  // ---- Sauvegarde / import JSON ----
  function backup(state, filename) {
    const b = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = (filename || 'archi-backup') + '.json';
    a.click();
  }
  function importFile(onLoad) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.addEventListener('change', async () => {
      try { onLoad(JSON.parse(await inp.files[0].text())); }
      catch (e) { alert('Fichier invalide'); }
    });
    inp.click();
  }

  function logout() {
    if (auth) auth.signOut().finally(() => location.replace('login.html'));
    else location.replace('login.html');
  }

  // ---- Changement de mot de passe (self-service, comme GLPI) ----
  function changePassword() {
    if (!auth || !auth.currentUser) { location.replace('login.html'); return; }
    const ov = document.createElement('div');
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:20px;font-family:var(--font,system-ui),sans-serif');
    const ipt = 'width:100%;padding:9px 11px;border-radius:9px;border:1px solid var(--line,#2a2f3a);background:var(--surface-2,#12151d);color:var(--text,#e7e9ee);font-size:14px;box-sizing:border-box';
    ov.innerHTML =
      '<div style="background:var(--card,#171a22);color:var(--text,#e7e9ee);border:1px solid var(--line,#2a2f3a);border-radius:14px;padding:22px;width:340px;max-width:100%">' +
      '<h3 style="font-family:var(--font-display,inherit);margin:0 0 14px;font-size:17px">Changer mon mot de passe</h3>' +
      '<label style="display:block;font-size:12px;color:var(--dim,#9aa0ad);margin:0 0 5px">Mot de passe actuel</label>' +
      '<input id="pz_cp_cur" type="password" autocomplete="current-password" style="' + ipt + ';margin-bottom:12px">' +
      '<label style="display:block;font-size:12px;color:var(--dim,#9aa0ad);margin:0 0 5px">Nouveau mot de passe (min. 6)</label>' +
      '<input id="pz_cp_new" type="password" autocomplete="new-password" style="' + ipt + '">' +
      '<div id="pz_cp_msg" style="font-size:12px;min-height:16px;margin-top:9px;color:var(--err,#f38b8b)"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">' +
      '<button id="pz_cp_cancel" type="button" style="padding:8px 14px;border-radius:9px;border:1px solid var(--line,#2a2f3a);background:transparent;color:var(--dim,#9aa0ad);font-size:13px;cursor:pointer">Annuler</button>' +
      '<button id="pz_cp_ok" type="button" style="padding:8px 14px;border-radius:9px;border:0;background:var(--accent,#6ea8fe);color:#06101f;font-weight:700;font-size:13px;cursor:pointer">Enregistrer</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    const close = () => ov.remove();
    const msg = t => { const m = ov.querySelector('#pz_cp_msg'); if (m) m.textContent = t; };
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('#pz_cp_cancel').addEventListener('click', close);
    ov.querySelector('#pz_cp_ok').addEventListener('click', async () => {
      const cur = ov.querySelector('#pz_cp_cur').value;
      const nw = ov.querySelector('#pz_cp_new').value;
      if (!cur || !nw) { msg('Remplis les deux champs.'); return; }
      if (nw.length < 6) { msg('Le nouveau mot de passe doit faire 6 caractères min.'); return; }
      const btn = ov.querySelector('#pz_cp_ok'); btn.disabled = true; btn.textContent = '…';
      try {
        const u = auth.currentUser;
        const cred = firebase.auth.EmailAuthProvider.credential(u.email, cur);
        await u.reauthenticateWithCredential(cred);
        await u.updatePassword(nw);
        msg('');
        ov.querySelector('div').innerHTML = '<div style="text-align:center;padding:6px 0"><div style="font-size:34px;margin-bottom:8px">✅</div><div style="margin-bottom:16px">Mot de passe mis à jour.</div><button type="button" id="pz_cp_done" style="padding:8px 16px;border-radius:9px;border:0;background:var(--accent,#6ea8fe);color:#06101f;font-weight:700;cursor:pointer">Fermer</button></div>';
        ov.querySelector('#pz_cp_done').addEventListener('click', close);
      } catch (e) {
        console.error(e);
        const map = { 'auth/wrong-password': 'Mot de passe actuel incorrect.', 'auth/invalid-credential': 'Mot de passe actuel incorrect.', 'auth/weak-password': 'Nouveau mot de passe trop faible.', 'auth/too-many-requests': 'Trop de tentatives, réessaie plus tard.' };
        msg(map[e.code] || ('Erreur : ' + (e.message || e.code)));
        btn.disabled = false; btn.textContent = 'Enregistrer';
      }
    });
    setTimeout(() => { const f = ov.querySelector('#pz_cp_cur'); if (f) f.focus(); }, 30);
  }

  // ---- Intégration Discord (webhooks, 100 % statique) ----
  // Config partagée : plazma/config → { discordWebhooks: { scrim, planning, scouting, … } }.
  const escHtml = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const isWebhookUrl = u => /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test((u || '').trim());
  let _discordCfg = null;
  function discordEnsureCfg() {
    if (_discordCfg) return Promise.resolve(_discordCfg);
    if (!db) { _discordCfg = {}; return Promise.resolve(_discordCfg); }
    return db.collection(COLLECTION).doc('config').get()
      .then(d => { _discordCfg = (d.exists && d.data().discordWebhooks) || {}; return _discordCfg; })
      .catch(e => { console.error('Discord config', e); _discordCfg = {}; return _discordCfg; });
  }
  const discordWebhook = ch => (_discordCfg && _discordCfg[ch]) || '';
  function discordSetWebhook(ch, url) {
    if (!db) return Promise.reject(new Error('Firebase indisponible'));
    return db.collection(COLLECTION).doc('config').set({ discordWebhooks: { [ch]: url } }, { merge: true })
      .then(() => { _discordCfg = _discordCfg || {}; _discordCfg[ch] = url; });
  }
  async function discordSend(url, payload) {
    // Discord peut renvoyer 429 (rate-limit) sur des envois rapprochés : on
    // respecte le délai « retry_after » et on retente, pour ne jamais perdre
    // un message au milieu d'une publication multi-messages.
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.status === 429) {
        let wait = 1000;
        try { const j = await res.clone().json(); if (j && j.retry_after) wait = Math.ceil(j.retry_after * 1000) + 250; } catch (e) {}
        await new Promise(r => setTimeout(r, Math.min(wait, 8000)));
        continue;
      }
      if (!res.ok) { let t = ''; try { t = await res.text(); } catch (e) {} throw new Error('Discord ' + res.status + (t ? ' · ' + t.slice(0, 140) : '')); }
      return;
    }
    throw new Error('Discord : rate-limit persistant, réessaie dans un instant.');
  }

  // Avatar affiché par Discord pour les messages ARCHI (logo, URL publique absolue).
  const _dcAvatar = (() => { try { return new URL('assets/logo-plazma.png', location.href).href; } catch (e) { return ''; } })();

  const _dcInp = 'width:100%;padding:9px 11px;border-radius:9px;border:1px solid var(--line,#2a2f3a);background:var(--surface-2,#12151d);color:var(--text,#e7e9ee);font-size:13px;box-sizing:border-box;font-family:inherit';
  const _dcGhost = 'padding:8px 14px;border-radius:9px;border:1px solid var(--line,#2a2f3a);background:transparent;color:var(--dim,#9aa0ad);font-size:13px;cursor:pointer;font-family:inherit';
  const _dcPrimary = 'padding:8px 14px;border-radius:9px;border:0;background:var(--accent,#6ea8fe);color:#06101f;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit';

  /** Ouvre l'aperçu d'un embed Discord et le publie après confirmation. */
  function discordPublish(opts) {
    opts = opts || {}; const channel = opts.channel || 'scrim';
    // Discord plafonne un message à 6000 caractères : un CR très détaillé peut
    // exiger plusieurs messages. On accepte donc un tableau d'embeds.
    const embeds = (opts.embeds && opts.embeds.length) ? opts.embeds : [opts.embed || {}];
    const ov = document.createElement('div');
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:20px;font-family:var(--font,system-ui),sans-serif');
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    const box = inner => { ov.innerHTML = '<div style="background:var(--card,#171a22);color:var(--text,#e7e9ee);border:1px solid var(--line,#2a2f3a);border-radius:14px;padding:22px;width:540px;max-width:100%;max-height:86vh;overflow:auto">' + inner + '</div>'; };
    const H = t => '<h3 style="font-family:var(--font-display,inherit);margin:0 0 4px;font-size:17px">' + t + '</h3>';

    function renderPreview() {
      const renderEmbed = embed => {
        const c = '#' + ((embed.color || 0x5865F2) & 0xFFFFFF).toString(16).padStart(6, '0');
        const fields = (embed.fields || []).map(f =>
          `<div style="margin-top:11px"><div style="font-size:12px;font-weight:700;color:var(--text,#e7e9ee)">${escHtml(f.name)}</div>` +
          `<div style="font-size:12.5px;color:var(--dim,#9aa0ad);white-space:pre-wrap;margin-top:2px">${escHtml(f.value)}</div></div>`).join('');
        return `<div style="border-left:4px solid ${c};background:var(--surface-2,#12151d);border-radius:8px;padding:13px 15px;margin-top:10px">` +
          `<div style="font-weight:700;font-size:14.5px">${escHtml(embed.title || '')}</div>` +
          (embed.description ? `<div style="font-size:12.5px;color:var(--dim,#9aa0ad);white-space:pre-wrap;margin-top:4px">${escHtml(embed.description)}</div>` : '') +
          `${fields}</div>`;
      };
      const multi = embeds.length > 1
        ? `<div style="font-size:12px;color:var(--muted,#8b90a0);margin-bottom:8px">Trop long pour un seul message Discord : sera publié en <b>${embeds.length} messages</b> à la suite.</div>`
        : '';
      box(H('Publier sur Discord') +
        `<div style="font-size:12px;color:var(--muted,#8b90a0);margin-bottom:14px">Aperçu du message — salon « ${escHtml(channel)} »</div>` +
        multi + embeds.map(renderEmbed).join('') +
        `<div id="pzdc_msg" style="font-size:12.5px;min-height:16px;margin-top:12px;color:var(--err,#f38b8b)"></div>` +
        `<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">` +
        `<button id="pzdc_cancel" style="${_dcGhost}">Annuler</button>` +
        `<button id="pzdc_send" style="${_dcPrimary}">📢 Publier</button></div>`);
      ov.querySelector('#pzdc_cancel').onclick = close;
      ov.querySelector('#pzdc_send').onclick = async () => {
        const url = discordWebhook(channel);
        const btn = ov.querySelector('#pzdc_send'); btn.disabled = true; btn.textContent = 'Envoi…';
        try {
          // Un message par embed → chaque message reste sous la limite Discord.
          for (let i = 0; i < embeds.length; i++) {
            const payload = { username: 'ARCHI', embeds: [embeds[i]] };
            if (_dcAvatar) payload.avatar_url = _dcAvatar;
            await discordSend(url, payload);
            if (embeds.length > 1) {
              btn.textContent = 'Envoi… ' + (i + 1) + '/' + embeds.length;
              if (i < embeds.length - 1) await new Promise(r => setTimeout(r, 350)); // évite le rate-limit
            }
          }
          box('<div style="text-align:center;padding:12px 0"><div style="font-size:38px;margin-bottom:8px">✅</div><div style="margin-bottom:18px">Publié sur Discord.</div><button id="pzdc_done" style="' + _dcPrimary + '">Fermer</button></div>');
          ov.querySelector('#pzdc_done').onclick = close;
        } catch (e) {
          console.error(e);
          const m = ov.querySelector('#pzdc_msg'); if (m) m.textContent = 'Échec de la publication : ' + e.message;
          btn.disabled = false; btn.textContent = '📢 Publier';
        }
      };
    }
    function renderConfig(canEdit) {
      if (!canEdit) {
        box(H('Publier sur Discord') +
          `<p style="font-size:13px;color:var(--muted,#8b90a0);line-height:1.5">Aucun salon Discord n'est encore configuré pour « ${escHtml(channel)} ». Demande à un administrateur d'ajouter l'URL du webhook.</p>` +
          `<div style="text-align:right;margin-top:12px"><button id="pzdc_cancel" style="${_dcGhost}">Fermer</button></div>`);
        ov.querySelector('#pzdc_cancel').onclick = close; return;
      }
      box(H('Configurer le salon Discord') +
        `<p style="font-size:12.5px;color:var(--muted,#8b90a0);line-height:1.5;margin-bottom:12px">Salon « ${escHtml(channel)} ». Dans Discord : <b>Paramètres du salon → Intégrations → Webhooks → Nouveau webhook → Copier l'URL</b>.</p>` +
        `<input id="pzdc_url" placeholder="https://discord.com/api/webhooks/…" style="${_dcInp}">` +
        `<div id="pzdc_msg" style="font-size:12.5px;min-height:16px;margin-top:9px;color:var(--err,#f38b8b)"></div>` +
        `<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px"><button id="pzdc_cancel" style="${_dcGhost}">Annuler</button><button id="pzdc_save" style="${_dcPrimary}">Enregistrer</button></div>`);
      ov.querySelector('#pzdc_cancel').onclick = close;
      ov.querySelector('#pzdc_save').onclick = async () => {
        const url = ov.querySelector('#pzdc_url').value.trim();
        const msg = ov.querySelector('#pzdc_msg');
        if (!isWebhookUrl(url)) { msg.textContent = 'URL de webhook Discord invalide.'; return; }
        try { await discordSetWebhook(channel, url); renderPreview(); }
        catch (e) { msg.textContent = 'Enregistrement impossible : ' + e.message; }
      };
    }
    box('<div style="text-align:center;color:var(--muted,#8b90a0);padding:24px">Chargement…</div>');
    discordEnsureCfg().then(() => { discordWebhook(channel) ? renderPreview() : renderConfig(isAdmin()); });
  }
  const discord = { publish: discordPublish, ensureConfig: discordEnsureCfg, webhook: discordWebhook, setWebhook: discordSetWebhook };

  // ---- API publique ----
  window.PZ = {
    db, COLLECTION, NAV, FIREBASE_CONFIG,
    mountNav, sync, status, nowTime, relTime, loadingDone,
    exportPNG, backup, importFile, logout, changePassword,
    USER_DOMAIN, discord,
    // Roster central
    getRoster, getCoach, player, onRoster, setPlayer, saveRoster,
    ROSTER_SLOTS, COACH_SLOT,
    // Authentification & accès
    auth: {
      get user() { return authUser; },
      get profile() { return profile; },
      can, canRead, canWrite, accessLevel, isAdmin, onAuth, SECTION_KEYS,
      ready: authReadyPromise,
      instance: auth,
      config: FIREBASE_CONFIG
    }
  };

  // ---- Escape global : ferme modaux / drawers / overlays ----
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    // Ferme le sélecteur de champions (priorité maximale)
    const champOv = document.querySelector('.champ-overlay.open');
    if (champOv) { champOv.classList.remove('open'); return; }
    // Ferme tout overlay ou drawer ouvert
    const ov = document.querySelector('.overlay.open, .drawer-ov.open');
    if (!ov) return;
    ov.classList.remove('open');
    // Ferme aussi les panneaux associés
    document.querySelectorAll('.modal, .drawer').forEach(el => el.classList.remove('open'));
  });

  // ---- Command Palette (Ctrl+K / Cmd+K) ----
  function _initCmdPalette() {
    const ICONS = {
      home:'🏠', schedule:'📅', scrim:'⚔️', scouting:'🔍',
      draft:'🎯', wiki:'📚', team:'👥', dashboard:'📊',
      coach:'🎙️', satisfaction:'⭐', 'satisfaction-coach':'📋', admin:'🔧'
    };
    const ov = document.createElement('div');
    ov.className = 'cmd-overlay';
    ov.id = 'pzCmdOv';
    ov.innerHTML =
      '<div class="cmd-palette">' +
        '<div class="cmd-search-wrap">' +
          '<span class="cmd-search-icon">🔍</span>' +
          '<input class="cmd-input" id="pzCmdInput" type="text" placeholder="Naviguer vers…" autocomplete="off">' +
          '<span class="cmd-shortcut-hint">Esc pour fermer</span>' +
        '</div>' +
        '<div class="cmd-results" id="pzCmdResults"></div>' +
        '<div class="cmd-foot">' +
          '<span class="cmd-kbd"><span class="cmd-key">↑</span><span class="cmd-key">↓</span> naviguer</span>' +
          '<span class="cmd-kbd"><span class="cmd-key">↵</span> ouvrir</span>' +
          '<span class="cmd-kbd"><span class="cmd-key">Esc</span> fermer</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    const input = ov.querySelector('#pzCmdInput');
    const resultsEl = ov.querySelector('#pzCmdResults');
    let selIdx = 0, currentItems = [];

    function getItems(q) {
      const list = NAV.filter(n => !n.section || can(n.section));
      if (isAdmin()) list.push({ key: 'admin', href: 'plazma-admin.html', label: 'Comptes' });
      if (!q) return list;
      const lq = q.toLowerCase();
      return list.filter(n => n.label.toLowerCase().includes(lq));
    }

    function render(q) {
      currentItems = getItems(q);
      selIdx = 0;
      if (!currentItems.length) {
        resultsEl.innerHTML = '<div class="cmd-empty">Aucun résultat pour « ' + q + ' »</div>';
        return;
      }
      resultsEl.innerHTML = (q ? '' : '<div class="cmd-section-label">Pages</div>') +
        currentItems.map((n, i) =>
          '<a class="cmd-item' + (i === 0 ? ' sel' : '') + '" href="' + n.href + '" data-idx="' + i + '">' +
            '<span class="cmd-item-icon">' + (ICONS[n.key] || '📄') + '</span>' +
            '<span class="cmd-item-label">' + n.label + '</span>' +
            '<span class="cmd-item-arrow">→</span>' +
          '</a>'
        ).join('');
      resultsEl.querySelectorAll('.cmd-item').forEach(el => {
        el.addEventListener('mouseenter', () => { selIdx = +el.dataset.idx; updateSel(); });
        el.addEventListener('click', close);
      });
    }

    function updateSel() {
      resultsEl.querySelectorAll('.cmd-item').forEach((el, i) => el.classList.toggle('sel', i === selIdx));
      const s = resultsEl.querySelector('.cmd-item.sel');
      if (s) s.scrollIntoView({ block: 'nearest' });
    }

    function open() {
      ov.classList.add('open');
      input.value = '';
      render('');
      requestAnimationFrame(() => input.focus());
    }
    function close() { ov.classList.remove('open'); }

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); ov.classList.contains('open') ? close() : open(); return; }
      if (!ov.classList.contains('open')) return;
      const items = resultsEl.querySelectorAll('.cmd-item');
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); selIdx = (selIdx + 1) % Math.max(1, items.length); updateSel(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); selIdx = (selIdx - 1 + Math.max(1, items.length)) % Math.max(1, items.length); updateSel(); }
      if (e.key === 'Enter' && items[selIdx]) { items[selIdx].click(); }
    });

    input.addEventListener('input', () => render(input.value.trim()));
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
  }

  // ---- Auto-wrap 📢 dans les boutons statiques pour l'animation shake ----
  function _initEmojiShake() {
    document.querySelectorAll('button, a[role="button"]').forEach(el => {
      if (el.querySelector('.pz-emoji-shake')) return;
      Array.from(el.childNodes).forEach(node => {
        if (node.nodeType !== 3 || !node.textContent.includes('📢')) return;
        const tmp = document.createElement('span');
        tmp.innerHTML = node.textContent.replace('📢', '<span class="pz-emoji-shake">📢</span>');
        node.replaceWith(...Array.from(tmp.childNodes));
      });
    });
  }

  // ---- Circuit board overlay ----
  function _initCircuit() {
    if (document.getElementById('pz-circuit')) return;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.id = 'pz-circuit';
    svg.setAttribute('viewBox', '0 0 1440 900');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('aria-hidden', 'true');

    // Orthogonal paths: lengths pre-calculated (sum of |dx|+|dy| per segment).
    // Using SVG attributes for dasharray/dashoffset avoids CSS unitless-number ambiguity.
    const pathDefs = [
      { d:'M80,100 L80,280 L260,280 L260,180 L420,180',           len:620, node:[260,280] },
      { d:'M1360,80 L1360,200 L1180,200 L1180,340 L980,340',      len:640, node:[1180,200] },
      { d:'M200,750 L200,600 L400,600 L400,500 L600,500 L600,620',len:770, node:[400,600]  },
      { d:'M1240,820 L1240,680 L1060,680 L1060,520 L880,520',     len:660, node:[1060,680] },
      { d:'M40,440 L200,440 L200,360 L380,360',                   len:420, node:[200,440]  },
      { d:'M1400,460 L1240,460 L1240,560 L1060,560',              len:440, node:[1240,460] },
      { d:'M600,820 L600,700 L760,700 L760,580 L900,580',         len:540, node:[760,700]  },
      { d:'M700,80 L700,220 L560,220 L560,340 L400,340',          len:560, node:[560,220]  },
      { d:'M900,140 L900,260 L1080,260 L1080,380 L1200,380',      len:540, node:[1080,260] },
      { d:'M320,480 L320,560 L480,560 L480,640 L640,640',         len:480, node:[480,560]  },
      { d:'M1100,700 L900,700 L900,780 L760,780',                 len:420, node:[900,700]  },
      { d:'M440,200 L580,200 L580,120 L740,120 L740,240',         len:500, node:[580,200]  },
    ];

    pathDefs.forEach(({ d, len, node }) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('stroke-dasharray', len);
      p.setAttribute('stroke-dashoffset', len);
      p.className = 'pz-cpath';
      const dur   = (14 + Math.random() * 16).toFixed(1);
      const delay = -(Math.random() * parseFloat(dur)).toFixed(1);
      p.style.setProperty('--len', len);
      p.style.animationDuration = dur + 's';
      p.style.animationDelay   = delay + 's';
      svg.appendChild(p);

      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', node[0]);
      c.setAttribute('cy', node[1]);
      c.setAttribute('r', '2.5');
      c.className = 'pz-cnode';
      const ndur   = (3 + Math.random() * 4).toFixed(1);
      const ndelay = -(Math.random() * parseFloat(ndur)).toFixed(1);
      c.style.animationDuration = ndur + 's';
      c.style.animationDelay   = ndelay + 's';
      svg.appendChild(c);
    });

    document.body.prepend(svg);
  }

  // Init spotlight + command palette après le DOM
  (function() {
    function _boot() { _initCircuit(); _initCmdPalette(); _initEmojiShake(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot, { once: true });
    else _boot();
  })();

  // ---- Zones de texte auto-extensibles ----
  // Chrome/Edge récents : géré nativement en CSS (field-sizing:content, dans theme.css).
  // Fallback JS pour les autres navigateurs.
  (function autoGrow() {
    const supported = window.CSS && CSS.supports && CSS.supports('field-sizing', 'content');
    if (supported) return;
    const grow = ta => {
      const max = Math.round(window.innerHeight * 0.6);
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, max) + 'px';
      ta.style.overflowY = ta.scrollHeight > max ? 'auto' : 'hidden';
    };
    const growAll = () => document.querySelectorAll('textarea').forEach(grow);
    document.addEventListener('input', e => { if (e.target && e.target.tagName === 'TEXTAREA') grow(e.target); });
    document.addEventListener('focusin', e => { if (e.target && e.target.tagName === 'TEXTAREA') grow(e.target); });
    window.addEventListener('load', growAll);
    // Re-mesure quand une valeur est posée par programme (chargement Firestore).
    try { new MutationObserver(() => growAll()).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  })();

  // Démarre la vérification d'accès (affiche l'overlay avant tout contenu).
  startAuth();
})();
