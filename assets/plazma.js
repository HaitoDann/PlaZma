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

  // ---- Version de l'application (SemVer) ----
  // MAJEUR.MINEUR.CORRECTIF — MINEUR à chaque lot de fonctionnalités,
  // CORRECTIF pour les corrections. Affichée discrètement dans Paramètres.
  const VERSION = '2.10.1';

  // ---- Niveau de performance : adapte la densité des effets ----
  // Full sur machine puissante (rendu identique), réduit sur mobile/appareil
  // faible, éteint si l'utilisateur demande de réduire les animations.
  // Choix manuel (Paramètres) prioritaire sur l'auto-détection.
  const PERF = (function () {
    try {
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';
      let saved = null; try { saved = localStorage.getItem('pz-quality'); } catch (e) {}
      if (saved === 'low' || saved === 'medium' || saved === 'high') return saved;
      const cores = navigator.hardwareConcurrency || 8;
      const mem = (typeof navigator.deviceMemory === 'number') ? navigator.deviceMemory : 8;
      const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      if (coarse && innerWidth < 760) return 'low';
      if (cores <= 4 && mem <= 4) return 'low';
      if (cores <= 4 || mem <= 4) return 'medium';
      if (cores >= 8 && mem >= 8 && innerWidth >= 1024) return 'high';
      return 'medium';
    } catch (e) { return 'medium'; }
  })();
  const PERF_SCALE = { off: 0, low: 0.35, medium: 0.6, high: 1 };
  const perfCount = n => Math.round(n * PERF_SCALE[PERF]);

  // ============ Suivi d'usage (jauges de quotas Firebase) ============
  // On compte localement les lectures/écritures/suppressions/connexions et on
  // pousse les DELTAS agrégés vers plazma/_usage (FieldValue.increment) au plus
  // une fois par minute → coût quasi nul, totaux partagés entre tous les postes.
  // Limites du plan gratuit Firebase (Spark) exposées pour la page d'admin.
  const SPARK_LIMITS = { reads: 50000, writes: 20000, deletes: 20000, storageBytes: 1073741824, egressBytesMonth: 10737418240 };
  const USAGE_DOC = '_usage';
  const USAGE_KEY = 'pz-usage';
  const _todayKey = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const _freshUsage = () => ({ date: _todayKey(), reads: 0, writes: 0, deletes: 0, logins: 0, fr: 0, fw: 0, fd: 0, fl: 0 });
  let _usage = (function () {
    try { const u = JSON.parse(localStorage.getItem(USAGE_KEY)); if (u && u.date === _todayKey()) return u; } catch (e) {}
    return _freshUsage();
  })();
  const _saveUsage = () => { try { localStorage.setItem(USAGE_KEY, JSON.stringify(_usage)); } catch (e) {} };
  let _flushTimer = 0;
  function _bumpUsage(kind, n) {
    if (_usage.date !== _todayKey()) _usage = _freshUsage();
    _usage[kind] += (n || 1);
    _saveUsage();
    if (!_flushTimer) _flushTimer = setTimeout(flushUsage, 60000);
  }
  function flushUsage() {
    _flushTimer = 0;
    if (!db || !window.firebase || !firebase.firestore) return;
    const dr = _usage.reads - _usage.fr, dw = _usage.writes - _usage.fw,
          dd = _usage.deletes - _usage.fd, dl = _usage.logins - _usage.fl;
    if (dr <= 0 && dw <= 0 && dd <= 0 && dl <= 0) return;
    const inc = firebase.firestore.FieldValue.increment;
    const payload = { updatedAt: Date.now() };
    payload[_usage.date] = { reads: inc(dr), writes: inc(dw), deletes: inc(dd), logins: inc(dl) };
    // NB : cette écriture de synthèse n'est volontairement pas recomptée.
    db.collection(COLLECTION).doc(USAGE_DOC).set(payload, { merge: true })
      .then(() => { _usage.fr = _usage.reads; _usage.fw = _usage.writes; _usage.fd = _usage.deletes; _usage.fl = _usage.logins; _saveUsage(); })
      .catch(() => {});
  }
  window.addEventListener('pagehide', flushUsage);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushUsage(); });
  // Présence par utilisateur : au plus une écriture par session (+1 connexion
  // si l'utilisateur vient de se logger). Alimente plazma/_usage.perUser
  // { <uid>: { name, logins, last } } → « qui utilise ARCHI ».
  function _trackPresence() {
    onAuth((user, prof) => {
      if (!user || !db || !window.firebase || !firebase.firestore) return;
      let justLoggedIn = false, firstThisSession = false;
      try { if (sessionStorage.getItem('pz-just-logged-in')) { justLoggedIn = true; sessionStorage.removeItem('pz-just-logged-in'); } } catch (e) {}
      try { if (!sessionStorage.getItem('pz-seen')) { sessionStorage.setItem('pz-seen', '1'); firstThisSession = true; } } catch (e) {}
      if (justLoggedIn) _bumpUsage('logins', 1);
      if (!justLoggedIn && !firstThisSession) return;   // limite les écritures
      const inc = firebase.firestore.FieldValue.increment;
      const name = (prof && (prof.name || prof.username)) || user.email || user.uid;
      const entry = { name: name, last: Date.now() };
      if (justLoggedIn) entry.logins = inc(1);
      // Écriture de présence volontairement non recomptée.
      db.collection(COLLECTION).doc(USAGE_DOC).set({ perUser: { [user.uid]: entry } }, { merge: true }).catch(() => {});
    });
  }

  // Lit le doc d'usage (pour la page d'admin) — compte 1 lecture.
  function getUsage() {
    if (!db) return Promise.resolve({ local: _usage, limits: SPARK_LIMITS, doc: {} });
    return db.collection(COLLECTION).doc(USAGE_DOC).get()
      .then(s => { _bumpUsage('reads', 1); return { local: _usage, limits: SPARK_LIMITS, doc: (s.exists ? s.data() : {}) }; })
      .catch(() => ({ local: _usage, limits: SPARK_LIMITS, doc: {} }));
  }

  // ============ Authentification & contrôle d'accès ============
  // La protection RÉELLE vient des règles de sécurité Firestore (firestore.rules).
  // Ce module gère la connexion, le profil de l'utilisateur et l'affichage
  // (redirection login, masquage des modules non autorisés).
  const SECTION_KEYS = ['planning', 'scrim', 'review', 'scouting', 'team', 'dashboard', 'coach', 'satisfaction', 'satisfactionResults', 'perf'];
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
    if ((page === 'plazma-admin.html' || page === 'plazma-site-admin.html') && !isAdmin()) { gate(deniedHtml('Cet espace est réservé aux administrateurs.')); return; }
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
        try { const s = await db.collection('users').doc(user.uid).get(); _bumpUsage('reads', 1); profile = s.exists ? s.data() : null; }
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

  let rosterOverrides = {};            // { id: { name, emoji } }  (5 postes fixes + coach)
  let rosterExtras = [];               // [ { id, name, emoji, role } ]  joueurs additionnels (dynamique)
  const rosterListeners = [];

  function resolveSlot(slot) {
    const o = rosterOverrides[slot.id] || {};
    return {
      id: slot.id, roleKey: slot.roleKey, role: slot.role, color: slot.color,
      name: (o.name && o.name.trim()) || slot.defaultName,
      emoji: (o.emoji && o.emoji.trim()) || slot.defaultEmoji
    };
  }
  const getRoster = () => ROSTER_SLOTS.map(resolveSlot);   // 5 postes de base (structurel, inchangé)
  const getCoach = () => resolveSlot(COACH_SLOT);
  const getExtras = () => rosterExtras.map(e => ({
    id: e.id, roleKey: 'extra', role: (e.role && e.role.trim()) || 'Joueur', color: 'var(--muted)',
    name: (e.name && e.name.trim()) || 'Joueur', emoji: (e.emoji && e.emoji.trim()) || '🎮', extra: true
  }));
  /** Effectif complet pour l'association de comptes : 5 postes + coach + joueurs additionnels. */
  const getPlayers = () => getRoster().concat([getCoach()]).concat(getExtras());
  const player = id => getPlayers().find(p => p.id === id) || null;

  function notifyRoster() {
    const r = getRoster(), c = getCoach();
    rosterListeners.forEach(cb => { try { cb(r, c); } catch (e) { console.error(e); } });
  }
  /** Enregistre un callback (r, coach) appelé maintenant puis à chaque MAJ du roster. */
  function onRoster(cb) { rosterListeners.push(cb); cb(getRoster(), getCoach()); }
  function setPlayer(id, patch) {
    const ex = rosterExtras.find(e => e.id === id);
    if (ex) { Object.assign(ex, patch); return; }
    rosterOverrides[id] = Object.assign({}, rosterOverrides[id], patch);
  }
  /** Ajoute un joueur additionnel au roster (dynamique). Renvoie son id. */
  function addPlayer(p) {
    const id = 'p_' + Math.random().toString(36).slice(2, 9);
    rosterExtras.push({ id, name: (p && p.name) || 'Joueur', emoji: (p && p.emoji) || '🎮', role: (p && p.role) || 'Joueur' });
    return id;
  }
  /** Retire un joueur additionnel (les 5 postes de base et le coach ne sont pas supprimables). */
  function removePlayer(id) { rosterExtras = rosterExtras.filter(e => e.id !== id); }
  function saveRoster() {
    if (!db) return Promise.resolve();
    _bumpUsage('writes', 1);
    return db.collection(COLLECTION).doc('roster').set(Object.assign({}, rosterOverrides, { _extras: rosterExtras }));
  }

  if (db) {
    db.collection(COLLECTION).doc('roster').onSnapshot(
      doc => {
        if (!doc.metadata.hasPendingWrites) _bumpUsage('reads', 1);
        const data = (doc.exists && doc.data()) || {};
        rosterExtras = Array.isArray(data._extras) ? data._extras : [];
        rosterOverrides = Object.assign({}, data); delete rosterOverrides._extras;
        notifyRoster();
      },
      e => console.error('roster', e)
    );
  }

  // ---- Navigation partagée ----
  const NAV = [
    { key: 'home',         href: 'index.html',              label: 'Accueil' },
    { key: 'schedule',     href: 'plazma-schedule.html',    label: 'Planning',     section: 'planning' },
    { key: 'scrim',        href: 'plazma-scrim.html',       label: 'CR Match',     section: 'scrim' },
    { key: 'review',       href: 'plazma-review-individuelle.html', label: 'Review', section: 'scrim' },
    { key: 'scouting',     href: 'plazma-scouting.html',    label: 'Scouting',     section: 'scouting' },
    { key: 'draft',        href: 'plazma-draft.html',       label: 'Draft',        section: 'scouting' },
    { key: 'theory',       href: 'plazma-theory.html',      label: 'Theorycraft' },
    { key: 'wiki',         href: 'plazma-wiki.html',        label: 'Wiki' },
    { key: 'wikiperf',     href: 'plazma-wiki-perf.html',   label: 'Encyclopédie' },
    { key: 'team',         href: 'plazma-team.html',        label: 'Équipe',       section: 'team' },
    { key: 'dashboard',    href: 'plazma-dashboard.html',   label: 'Dashboard',    section: 'dashboard' },
    { key: 'coach',        href: 'plazma-coach.html',       label: 'Coach',        section: 'coach' },
    { key: 'satisfaction', href: 'plazma-satisfaction.html',label: 'Satisfaction', section: 'satisfaction' }
  ];

  let _navActive = null, _navMount;
  let _ideaUnread = 0;   // nb d'idées non lues (badge Système, admins)
  /** Injecte la barre de navigation (filtrée selon les accès de l'utilisateur). */
  function mountNav(activeKey, mountSel) {
    _navActive = activeKey; _navMount = mountSel; renderNav();
  }
  /** Re-rend la nav quand le profil d'accès change (appelé après résolution auth). */
  function refreshNav() { if (_navActive !== null || _navMount !== undefined) renderNav(); }
  // ---- Thème light / dark ----
  const THEME_KEY = 'pz-theme';
  function _applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const label = t === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair';
    // Toggles jour/nuit (nav + FAB accueil) : le visuel est piloté par [data-theme]
    // en CSS, on ne met à jour que le libellé (ne pas écraser le contenu du toggle).
    document.querySelectorAll('.pz-daynight').forEach(btn => {
      btn.title = label;
      btn.setAttribute('aria-label', label);
    });
  }
  // Mémorise la position du dernier clic sur un bouton thème (origine de l'animation).
  let _themeOrigin = null;
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.pz-daynight');
    if (b) _themeOrigin = { x: e.clientX, y: e.clientY };
  }, true);
  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    const apply = () => { try { localStorage.setItem(THEME_KEY, next); } catch(e) {} _applyTheme(next); };
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Révélation circulaire depuis le bouton (View Transitions API) — sinon simple bascule.
    if (!document.startViewTransition || reduce) { apply(); return; }
    const o = _themeOrigin || { x: innerWidth - 40, y: 40 };
    const r = Math.hypot(Math.max(o.x, innerWidth - o.x), Math.max(o.y, innerHeight - o.y));
    document.documentElement.classList.add('pz-theme-anim');
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${o.x}px ${o.y}px)`, `circle(${r}px at ${o.x}px ${o.y}px)`] },
        { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
    vt.finished.finally(() => document.documentElement.classList.remove('pz-theme-anim'));
  }
  // Lire la préférence sauvegardée (ou système) le plus tôt possible
  (function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch(e) {}
    const preferred = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    _applyTheme(preferred);
  })();

  function renderNav() {
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const disabled = (siteGet().disabled) || [];
    let links = NAV.filter(n => (!n.section || can(n.section)) && (isAdmin() || disabled.indexOf(n.key) === -1))
      .map(n => {
        const off = disabled.indexOf(n.key) !== -1;
        const cls = [n.key === _navActive ? 'active' : '', off ? 'pz-nav-off' : ''].filter(Boolean).join(' ');
        return `<a href="${n.href}"${cls ? ` class="${cls}"` : ''}${off ? ' title="Section désactivée"' : ''}>${n.label}</a>`;
      }).join('');
    if (isAdmin()) links += `<a href="plazma-admin.html"${_navActive === 'admin' ? ' class="active"' : ''}>Comptes</a>`;
    if (isAdmin()) links += `<a href="plazma-site-admin.html"${_navActive === 'site' ? ' class="active"' : ''} style="position:relative">Système${_ideaUnread > 0 ? `<span class="pz-idea-badge">${_ideaUnread > 9 ? '9+' : _ideaUnread}</span>` : ''}</a>`;
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const themeTitle = currentTheme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair';
    const themeBtn = `<button class="pz-daynight" type="button" onclick="PZ.toggleTheme()" title="${themeTitle}" aria-label="${themeTitle}"><span class="dn-stars"></span><span class="dn-clouds"></span><span class="dn-knob"></span></button>`;
    const who = profile
      ? `<div class="pz-nav-right">${themeBtn}` +
        `<button class="pz-nav-ico" type="button" onclick="PZ.openIdeas()" title="Boîte à idées" aria-label="Boîte à idées"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><g class="bulb-rays"><line x1="5.5" y1="5" x2="3.8" y2="3.4"/><line x1="12" y1="1.4" x2="12" y2="0"/><line x1="18.5" y1="5" x2="20.2" y2="3.4"/></g><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 0-4 10c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5a6 6 0 0 0-4-10Z"/></svg></button>` +
        `<button class="pz-nav-user" type="button" onclick="PZ.changePassword()" title="Changer mon mot de passe">${esc(profile.name || profile.username || '')}</button>` +
        `<button class="pz-logout" type="button" onclick="PZ.logout()" title="Se déconnecter" aria-label="Se déconnecter"><svg class="pz-power" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path class="pz-power-ring" d="M7.8 6.3a7 7 0 1 0 8.4 0"/><line class="pz-power-bar" x1="12" y1="3.2" x2="12" y2="11.5"/></svg></button></div>`
      : `<div class="pz-nav-right">${themeBtn}</div>`;
    const html =
      `<div class="pz-topbar"><div class="pz-topbar-inner">
        <a class="pz-brand" href="index.html">
          <span class="pz-brand-mark"><img src="assets/logo-plazma.png" alt="ARCHI"></span>
          <span><span class="pz-brand-name">ARCHI</span><span class="pz-ver" title="Version d'ARCHI">v${VERSION}</span></span>
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
          _bumpUsage('reads', 1);                                // lecture distante comptabilisée
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
      _bumpUsage('writes', 1);
      return db.collection(COLLECTION).doc(resolveId()).set(state)
        .then(() => status('connected', 'Synchronisé', nowTime()))
        .catch(e => { console.error(e); status('error', 'Erreur Firebase'); });
    }

    function reset(confirmMsg) {
      if (confirmMsg && !confirm(confirmMsg)) return;
      if (!db) return;
      _bumpUsage('deletes', 1);
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

  // ---- Fenêtre générique (overlay auto-suffisant, sans dépendance CSS) ----
  function _overlay(inner, width) {
    const ov = document.createElement('div');
    ov.tabIndex = -1;
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:20px;font-family:var(--font,system-ui),sans-serif;opacity:0;transition:opacity .18s');
    ov.innerHTML = '<div style="background:var(--surface,#171a22);color:var(--text,#e7e9ee);border:1px solid var(--border-2,#2a2f3a);border-radius:16px;padding:22px;width:' + (width || 360) + 'px;max-width:100%;box-shadow:0 24px 60px rgba(0,0,0,.5)">' + inner + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(() => { ov.style.opacity = '1'; });
    const close = () => { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 180); };
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    ov.focus();
    return { ov, close };
  }

  // ---- Boîte à idées — tout utilisateur peut proposer ----
  const IDEA_CATS = [
    ['feature', '✨ Fonctionnalité'], ['improve', '⚡ Amélioration'],
    ['bug', '🐞 Bug / souci'], ['team', '🎯 Équipe / staff'], ['other', '💬 Autre']
  ];
  const IDEA_CAT_LABEL = Object.fromEntries(IDEA_CATS);
  function _myIdeas() { try { return JSON.parse(localStorage.getItem('pz-my-ideas') || '[]') || []; } catch (e) { return []; } }
  function _pushMyIdea(o) { try { const a = _myIdeas(); a.unshift(o); localStorage.setItem('pz-my-ideas', JSON.stringify(a.slice(0, 50))); } catch (e) {} }
  function submitIdea(text, meta) {
    const t = (text || '').trim();
    if (!db) return Promise.reject(new Error('offline'));
    if (!t) return Promise.reject(new Error('vide'));
    const category = (meta && meta.category) || 'other';
    _bumpUsage('writes', 1);
    // Compteur global d'idées (pour le badge « non lues » des admins).
    try {
      if (window.firebase && firebase.firestore) {
        db.collection(COLLECTION).doc(USAGE_DOC).set({ ideasTotal: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(() => {});
      }
    } catch (e) {}
    return db.collection('plazma-ideas').add({
      text: t.slice(0, 2000),
      category,
      status: 'new',
      author: authUser ? authUser.uid : null,
      authorName: (profile && (profile.name || profile.username)) || 'Anonyme',
      ts: Date.now()
    }).then(ref => { _pushMyIdea({ text: t.slice(0, 500), category, ts: Date.now() }); return ref; });
  }
  // Badge « idées non lues » pour les admins (Système). Lit le compteur global.
  function _setFabIdeaBadge() {
    const fab = document.getElementById('sysBtn');
    if (!fab) return;
    fab.querySelectorAll('.pz-idea-badge').forEach(b => b.remove());
    if (_ideaUnread > 0) {
      fab.style.position = 'relative';
      const b = document.createElement('span');
      b.className = 'pz-idea-badge';
      b.textContent = _ideaUnread > 9 ? '9+' : _ideaUnread;
      fab.appendChild(b);
    }
  }
  function _initIdeaBadge() {
    onAuth(user => {
      if (!user || !db || !isAdmin()) return;
      db.collection(COLLECTION).doc(USAGE_DOC).get().then(s => {
        const total = (s.exists && s.data().ideasTotal) || 0;
        let seen = 0; try { seen = parseInt(localStorage.getItem('pz-ideas-seen') || '0', 10) || 0; } catch (e) {}
        _ideaUnread = Math.max(0, total - seen);
        refreshNav();
        _setFabIdeaBadge();
      }).catch(() => {});
    });
  }
  // Appelée par la page Système une fois les idées consultées.
  function markIdeasSeen(total) {
    try { localStorage.setItem('pz-ideas-seen', String(total || 0)); } catch (e) {}
    _ideaUnread = 0; refreshNav(); _setFabIdeaBadge();
  }
  const MAX_IDEA = 500;
  function openIdeas() {
    const inp = 'width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--border-2);background:var(--surface-2);color:var(--text);font-family:inherit;font-size:14px';
    const cats = IDEA_CATS.map(([v, l], i) =>
      '<button type="button" class="pz-idea-cat" data-cat="' + v + '"' +
      ' style="padding:6px 11px;border-radius:20px;border:1px solid var(--border-2);cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;' +
      (i === 0 ? 'background:var(--accent-soft);color:var(--accent);border-color:transparent' : 'background:transparent;color:var(--muted)') + '">' + l + '</button>').join('');
    const tab = (id, l, on) => '<button type="button" class="pz-idea-tab" data-tab="' + id + '" style="flex:1;padding:9px 6px;border:0;background:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;border-bottom:2px solid ' + (on ? 'var(--accent)' : 'transparent') + ';color:' + (on ? 'var(--text)' : 'var(--muted)') + '">' + l + '</button>';
    const { ov, close } = _overlay(
      '<h3 style="font-family:var(--font-display,inherit);margin:0 0 3px;font-size:17px">💡 Boîte à idées</h3>' +
      '<p style="color:var(--muted);font-size:12.5px;margin:0 0 12px">Propose une idée, un axe d\'amélioration ou signale un souci. Le staff les consulte dans l\'administration.</p>' +
      '<div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:14px">' + tab('new', 'Proposer', true) + tab('mine', 'Mes idées', false) + '</div>' +
      // --- Onglet Proposer ---
      '<div id="pz_tab_new">' +
      '<div style="font-size:12px;color:var(--dim);font-weight:600;margin-bottom:6px">Catégorie</div>' +
      '<div id="pz_idea_cats" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:13px">' + cats + '</div>' +
      '<div style="font-size:12px;color:var(--dim);font-weight:600;margin-bottom:6px">Ton idée</div>' +
      '<textarea id="pz_idea" rows="4" maxlength="' + MAX_IDEA + '" placeholder="Décris ton idée le plus clairement possible…" style="' + inp + ';resize:vertical"></textarea>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">' +
      '<span id="pz_idea_msg" style="font-size:12px;color:var(--muted)"></span>' +
      '<span id="pz_idea_count" style="font-size:11px;color:var(--muted)">0/' + MAX_IDEA + '</span></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
      '<button type="button" id="pz_idea_cancel" style="padding:8px 14px;border-radius:9px;border:1px solid var(--border-2);background:transparent;color:var(--dim);font-size:13px;cursor:pointer">Fermer</button>' +
      '<button type="button" id="pz_idea_send" style="padding:8px 16px;border-radius:9px;border:0;background:var(--accent);color:#04252d;font-weight:700;font-size:13px;cursor:pointer">Envoyer</button>' +
      '</div></div>' +
      // --- Onglet Mes idées ---
      '<div id="pz_tab_mine" style="display:none"><div id="pz_mine_list"></div></div>', 430
    );
    let cat = 'feature';
    const msg = t => { const m = ov.querySelector('#pz_idea_msg'); if (m) m.textContent = t; };
    ov.querySelectorAll('.pz-idea-cat').forEach(b => b.addEventListener('click', () => {
      cat = b.dataset.cat;
      ov.querySelectorAll('.pz-idea-cat').forEach(x => { const on = x === b;
        x.style.background = on ? 'var(--accent-soft)' : 'transparent';
        x.style.color = on ? 'var(--accent)' : 'var(--muted)';
        x.style.borderColor = on ? 'transparent' : 'var(--border-2)'; });
    }));
    const ta = ov.querySelector('#pz_idea'); const cnt = ov.querySelector('#pz_idea_count');
    if (ta) { ta.addEventListener('input', () => { cnt.textContent = ta.value.length + '/' + MAX_IDEA; }); ta.focus(); }
    ov.querySelector('#pz_idea_cancel').addEventListener('click', close);
    // Onglets
    function renderMine() {
      const list = _myIdeas();
      const host = ov.querySelector('#pz_mine_list');
      if (!list.length) { host.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:26px 10px;border:1px dashed var(--border);border-radius:12px">Tu n\'as pas encore proposé d\'idée.</div>'; return; }
      host.innerHTML = list.map(o => {
        const d = new Date(o.ts); const when = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        return '<div style="border:1px solid var(--border);border-radius:11px;padding:10px 13px;margin-bottom:8px;background:var(--surface)">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px">' +
          '<span style="font-size:11px;font-weight:700;color:var(--accent)">' + (IDEA_CAT_LABEL[o.category] || '💬 Autre') + '</span>' +
          '<span style="font-size:11px;color:var(--muted)">' + when + '</span></div>' +
          '<div style="font-size:13px;color:var(--text);line-height:1.45;white-space:pre-wrap">' + escHtml(o.text) + '</div></div>';
      }).join('');
    }
    ov.querySelectorAll('.pz-idea-tab').forEach(t => t.addEventListener('click', () => {
      const id = t.dataset.tab;
      ov.querySelectorAll('.pz-idea-tab').forEach(x => { const on = x === t;
        x.style.borderBottomColor = on ? 'var(--accent)' : 'transparent'; x.style.color = on ? 'var(--text)' : 'var(--muted)'; });
      ov.querySelector('#pz_tab_new').style.display = id === 'new' ? '' : 'none';
      ov.querySelector('#pz_tab_mine').style.display = id === 'mine' ? '' : 'none';
      if (id === 'mine') renderMine();
    }));
    ov.querySelector('#pz_idea_send').addEventListener('click', () => {
      const v = ta.value;
      if (!v.trim()) { msg('Écris ton idée d\'abord.'); return; }
      const btn = ov.querySelector('#pz_idea_send'); btn.disabled = true; btn.textContent = '…';
      submitIdea(v, { category: cat })
        .then(() => { close(); if (typeof toast === 'function') toast('Merci ! Ton idée a été envoyée.', 'ok'); })
        .catch(() => { msg('Envoi impossible. Réessaie.'); btn.disabled = false; btn.textContent = 'Envoyer'; });
    });
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
      .then(d => { _bumpUsage('reads', 1); _discordCfg = (d.exists && d.data().discordWebhooks) || {}; return _discordCfg; })
      .catch(e => { console.error('Discord config', e); _discordCfg = {}; return _discordCfg; });
  }
  const discordWebhook = ch => (_discordCfg && _discordCfg[ch]) || '';
  function discordSetWebhook(ch, url) {
    if (!db) return Promise.reject(new Error('Firebase indisponible'));
    _bumpUsage('writes', 1);
    return db.collection(COLLECTION).doc('config').set({ discordWebhooks: { [ch]: url } }, { merge: true })
      .then(() => { _discordCfg = _discordCfg || {}; _discordCfg[ch] = url; });
  }

  // ============ Configuration du site (annonce, sections, maintenance) ============
  // Stockée dans plazma/config → { site: { announcement:{text,type,on}, disabled:[keys], maintenance:bool } }.
  const SITE_DEFAULT = { announcement: { text: '', type: 'info', on: false }, disabled: [], maintenance: false };
  let _siteCfg = null;
  function siteEnsureCfg() {
    if (_siteCfg) return Promise.resolve(_siteCfg);
    if (!db) { _siteCfg = Object.assign({}, SITE_DEFAULT); return Promise.resolve(_siteCfg); }
    return db.collection(COLLECTION).doc('config').get()
      .then(d => { _bumpUsage('reads', 1); _siteCfg = Object.assign({}, SITE_DEFAULT, (d.exists && d.data().site) || {}); return _siteCfg; })
      .catch(() => { _siteCfg = Object.assign({}, SITE_DEFAULT); return _siteCfg; });
  }
  function siteGet() { return _siteCfg || SITE_DEFAULT; }
  function siteSave(patch) {
    if (!db) return Promise.reject(new Error('Firebase indisponible'));
    _siteCfg = Object.assign({}, SITE_DEFAULT, _siteCfg || {}, patch);
    _bumpUsage('writes', 1);
    return db.collection(COLLECTION).doc('config').set({ site: _siteCfg }, { merge: true });
  }
  // Applique l'annonce (bandeau) + le mode maintenance au chargement.
  function _applySite() {
    const s = siteGet();
    _renderAnnounce(s.announcement);
    if (s.maintenance && NEEDS_AUTH && !isAdmin()) _showMaintenance();
  }
  function _renderAnnounce(a) {
    const old = document.getElementById('pz-announce');
    if (old) old.remove();
    if (!a || !a.on || !a.text) return;
    const bar = document.createElement('div');
    bar.id = 'pz-announce';
    bar.className = 'pz-announce ' + (a.type || 'info');
    bar.innerHTML = '<span class="pz-announce-ico">' + (a.type === 'warn' ? '⚠️' : a.type === 'ok' ? '✅' : 'ℹ️') + '</span><span></span><button type="button" class="pz-announce-x" aria-label="Fermer">✕</button>';
    bar.querySelector('span:nth-child(2)').textContent = a.text;
    bar.querySelector('.pz-announce-x').onclick = () => bar.remove();
    document.body.prepend(bar);
  }
  function _showMaintenance() {
    if (document.getElementById('pz-maint')) return;
    const ov = document.createElement('div');
    ov.id = 'pz-maint';
    ov.className = 'pz-maint';
    ov.innerHTML = '<div class="pz-maint-box">' +
      '<div class="pz-maint-logo"><img src="assets/logo-plazma.png" alt="ARCHI"></div>' +
      '<span class="pz-maint-tag">Maintenance</span>' +
      '<h2>ARCHI revient vite</h2>' +
      '<p>Le staff effectue une mise à jour. Le site sera de nouveau accessible dans quelques instants.</p>' +
      '<div class="pz-maint-dots"><span></span><span></span><span></span></div>' +
      '<div class="pz-maint-foot">PlaZma Esport · ARCHI v' + VERSION + '</div></div>';
    document.body.appendChild(ov);
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
    db, COLLECTION, NAV, FIREBASE_CONFIG, VERSION,
    mountNav, sync, status, nowTime, relTime, loadingDone,
    exportPNG, backup, importFile, logout, changePassword,
    toggleTheme, toast, perf: PERF,
    openIdeas, submitIdea, markIdeasSeen,
    // Suivi d'usage & quotas
    getUsage, flushUsage, SPARK_LIMITS,
    // Configuration du site
    siteEnsureCfg, siteGet, siteSave,
    USER_DOMAIN, discord,
    // Roster central
    getRoster, getCoach, getExtras, getPlayers, player, onRoster, setPlayer, addPlayer, removePlayer, saveRoster,
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
      if (isAdmin()) list.push({ key: 'site', href: 'plazma-site-admin.html', label: 'Système' });
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

  // ---- Particules ascendantes ----
  function _initParticles() {
    if (document.getElementById('pz-particles')) return;
    const N = perfCount(18);
    if (!N) return;   // 'off' : aucun décor
    const c = document.createElement('div');
    c.id = 'pz-particles';
    c.setAttribute('aria-hidden', 'true');
    document.body.prepend(c);
    const colors = ['#22d3ee', '#6366f1', '#22d3ee'];
    for (let i = 0; i < N; i++) {
      const el = document.createElement('span');
      const size   = (2 + Math.random() * 3).toFixed(1);
      const left   = (Math.random() * 100).toFixed(1);
      const drift  = ((Math.random() - .5) * 80).toFixed(0);
      const dur    = (8 + Math.random() * 12).toFixed(1);
      const op     = (0.07 + Math.random() * 0.09).toFixed(3);
      const delay  = -(Math.random() * parseFloat(dur)).toFixed(1);
      const color  = colors[Math.floor(Math.random() * colors.length)];
      el.className = 'pz-particle';
      el.style.cssText = `left:${left}vw;width:${size}px;height:${size}px;background:${color};color:${color};--op:${op};--drift:${drift}px;animation-duration:${dur}s;animation-delay:${delay}s;`;
      c.appendChild(el);
    }
  }

  // ---- Toasts flottants ----
  function toast(msg, type) {
    let host = document.getElementById('pz-toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'pz-toasts';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'pz-toast' + (type ? ' ' + type : '');
    const dot = document.createElement('span'); dot.className = 'pz-toast-dot';
    const txt = document.createElement('span'); txt.textContent = msg;
    t.append(dot, txt);
    host.appendChild(t);
    let done = false;
    const dismiss = () => {
      if (done) return; done = true;
      t.classList.add('out');
      setTimeout(() => t.remove(), 420);
    };
    const life = setTimeout(dismiss, 4800);
    t.addEventListener('click', () => { clearTimeout(life); dismiss(); });
    return t;
  }

  // ---- Poussière d'étoiles avec parallaxe ----
  function _initStars() {
    if (document.getElementById('pz-stars')) return;
    const wrap = document.createElement('div');
    wrap.id = 'pz-stars';
    wrap.setAttribute('aria-hidden', 'true');
    const layers = [
      { count: perfCount(26), depth: 8,  smax: 1.4, op: [.20, .45] },
      { count: perfCount(16), depth: 18, smax: 2.0, op: [.30, .60] },
      { count: perfCount(8),  depth: 34, smax: 2.8, op: [.40, .75] },
    ];
    const layerEls = [];
    layers.forEach(cfg => {
      const layer = document.createElement('div');
      layer.className = 'pz-star-layer';
      for (let i = 0; i < cfg.count; i++) {
        const s = document.createElement('span');
        const size = (0.8 + Math.random() * cfg.smax).toFixed(1);
        const op   = (cfg.op[0] + Math.random() * (cfg.op[1] - cfg.op[0])).toFixed(2);
        const tw   = (3 + Math.random() * 5).toFixed(1);
        const twd  = -(Math.random() * 8).toFixed(1);
        s.className = 'pz-star';
        s.style.cssText = `left:${(Math.random()*100).toFixed(2)}%;top:${(Math.random()*100).toFixed(2)}%;width:${size}px;height:${size}px;--o:${op};opacity:${op};animation-duration:${tw}s;animation-delay:${twd}s;`;
        layer.appendChild(s);
      }
      wrap.appendChild(layer);
      layerEls.push({ el: layer, depth: cfg.depth });
    });
    document.body.prepend(wrap);
    // Parallaxe désactivée (coût mousemove continu) : étoiles statiques + scintillement.
  }

  // ---- Curseur personnalisé ARCHI (point précis, sans anneau) ----
  function _initCursor() {
    if (!window.matchMedia || !matchMedia('(pointer:fine)').matches) return;
    if (document.getElementById('pz-cur-dot')) return;
    const dot = document.createElement('div');
    dot.id = 'pz-cur-dot';
    dot.className = 'pz-hide';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    document.documentElement.classList.add('pz-cursor');

    const HOT  = 'a,button,.btn,.tool,.pcard,label,summary,select,[onclick],[role=button],input[type=checkbox],input[type=radio]';
    const TEXT = 'input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable]';
    window.addEventListener('mousemove', e => {
      dot.style.transform = `translate(${e.clientX}px,${e.clientY}px) translate(-50%,-50%)`;
      const t = e.target;
      dot.classList.toggle('pz-hide', !!(t && t.closest && t.closest(TEXT)));
      dot.classList.toggle('pz-hot',  !!(t && t.closest && t.closest(HOT)));
    }, { passive: true });
    document.addEventListener('mouseleave', () => dot.classList.add('pz-hide'));
    document.addEventListener('mouseenter', () => dot.classList.remove('pz-hide'));
  }

  // ---- Compteurs animés (0 → valeur) ----
  function _parseCount(text) {
    if (text == null) return null;
    const raw = String(text).trim();
    if (!raw) return null;
    const nums = raw.match(/\d+/g);
    if (!nums || nums.length !== 1) return null;
    const m = raw.match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/);
    if (!m) return null;
    const decimals = /[.,]/.test(m[2]) ? m[2].split(/[.,]/)[1].length : 0;
    return { num: parseFloat(m[2].replace(',', '.')), decimals, prefix: m[1], suffix: m[3], raw };
  }
  function _runCount(el, reduce) {
    const t = el.__pzCount;
    if (reduce) { el.textContent = t.raw; return; }
    const dur = 900, start = performance.now();
    (function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = t.prefix + (t.num * eased).toFixed(t.decimals) + t.suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = t.raw;
    })(start);
  }
  function _initCounters(reduce) {
    const SEL = '[data-count], .kpi-val, .rp-kpi-val';
    const seen = new WeakSet();
    const io = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); _runCount(e.target, reduce); } });
    }, { threshold: .6 }) : null;
    const consider = el => {
      if (seen.has(el) || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
      const parsed = _parseCount(el.getAttribute('data-count') != null ? el.getAttribute('data-count') : el.textContent);
      if (!parsed) return;
      seen.add(el);
      el.__pzCount = parsed;
      if (io) io.observe(el); else _runCount(el, reduce);
    };
    const scan = root => {
      if (!root || root.nodeType !== 1) return;
      if (root.matches && root.matches(SEL)) consider(root);
      if (root.querySelectorAll) root.querySelectorAll(SEL).forEach(consider);
    };
    scan(document.body);
    try { new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(scan))).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }

  // Init spotlight + command palette après le DOM
  (function() {
    const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    function _boot() {
      _initParticles();
      if (!reduce) { _initStars(); }
      _initCounters(reduce);
      _initCmdPalette();
      _initEmojiShake();
      // Présence : compte les connexions (global + par utilisateur) et l'activité.
      _trackPresence();
      // Badge « idées non lues » sur le bouton Système (admins).
      _initIdeaBadge();
      // Config du site : bandeau d'annonce (immédiat) + maintenance (après auth).
      if (page !== 'login.html') {
        siteEnsureCfg().then(() => {
          refreshNav();
          _renderAnnounce(siteGet().announcement);
          if (siteGet().maintenance && NEEDS_AUTH) {
            onAuth(() => { if (siteGet().maintenance && !isAdmin()) _showMaintenance(); });
          }
        });
      }
    }
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
