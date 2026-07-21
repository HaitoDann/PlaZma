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
    if (pageSection && accessLevel(pageSection) === 'view') showReadOnlyBanner();
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

  function startAuth() {
    if (!auth) {
      authResolved = true; _resolveReady({ user: null, profile: null });
      if (NEEDS_AUTH) location.replace('login.html');
      return;
    }
    if (NEEDS_AUTH) gate(spinnerHtml);
    auth.onAuthStateChanged(async user => {
      authUser = user ? { uid: user.uid, email: user.email } : null;
      if (user && db) {
        try { const s = await db.collection('users').doc(user.uid).get(); profile = s.exists ? s.data() : null; }
        catch (e) { console.error('Chargement du profil impossible', e); profile = null; }
      } else profile = null;
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
    const dot = document.getElementById('syncDot');
    const txt = document.getElementById('syncText');
    const tim = document.getElementById('syncTime');
    if (dot) dot.className = 'sync-dot ' + state;
    if (txt) txt.textContent = text || '';
    if (tim) tim.textContent = time || '';
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
  function sync(opts) {
    const { getState, applyState, onData } = opts;
    const resolveId = () =>
      (typeof opts.docId === 'function' ? opts.docId() : opts.docId);
    let unsub = null;
    let current = null;

    function start() {
      if (!db) { status('error', 'Firebase indisponible'); loadingDone(); return; }
      if (unsub) { unsub(); unsub = null; }
      current = resolveId();
      status('syncing', 'Connexion…');
      unsub = db.collection(COLLECTION).doc(current).onSnapshot(
        doc => {
          if (doc.metadata.hasPendingWrites) return;
          if (doc.exists) { applyState && applyState(doc.data()); status('connected', 'Synchronisé', nowTime()); }
          else status('connected', 'Vide', '');
          onData && onData(doc.exists);
          loadingDone();
        },
        err => { console.error(err); status('error', 'Erreur de connexion'); loadingDone(); }
      );
    }

    function save() {
      if (!db) { status('error', 'Firebase indisponible'); return Promise.resolve(); }
      status('syncing', 'Sauvegarde…');
      return db.collection(COLLECTION).doc(resolveId()).set(getState())
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
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { let t = ''; try { t = await res.text(); } catch (e) {} throw new Error('Discord ' + res.status + (t ? ' · ' + t.slice(0, 140) : '')); }
  }

  const _dcInp = 'width:100%;padding:9px 11px;border-radius:9px;border:1px solid var(--line,#2a2f3a);background:var(--surface-2,#12151d);color:var(--text,#e7e9ee);font-size:13px;box-sizing:border-box;font-family:inherit';
  const _dcGhost = 'padding:8px 14px;border-radius:9px;border:1px solid var(--line,#2a2f3a);background:transparent;color:var(--dim,#9aa0ad);font-size:13px;cursor:pointer;font-family:inherit';
  const _dcPrimary = 'padding:8px 14px;border-radius:9px;border:0;background:var(--accent,#6ea8fe);color:#06101f;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit';

  /** Ouvre l'aperçu d'un embed Discord et le publie après confirmation. */
  function discordPublish(opts) {
    opts = opts || {}; const channel = opts.channel || 'scrim'; const embed = opts.embed || {};
    const ov = document.createElement('div');
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:20px;font-family:var(--font,system-ui),sans-serif');
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    const box = inner => { ov.innerHTML = '<div style="background:var(--card,#171a22);color:var(--text,#e7e9ee);border:1px solid var(--line,#2a2f3a);border-radius:14px;padding:22px;width:540px;max-width:100%;max-height:86vh;overflow:auto">' + inner + '</div>'; };
    const H = t => '<h3 style="font-family:var(--font-display,inherit);margin:0 0 4px;font-size:17px">' + t + '</h3>';

    function renderPreview() {
      const c = '#' + ((embed.color || 0x5865F2) & 0xFFFFFF).toString(16).padStart(6, '0');
      const fields = (embed.fields || []).map(f =>
        `<div style="margin-top:11px"><div style="font-size:12px;font-weight:700;color:var(--text,#e7e9ee)">${escHtml(f.name)}</div>` +
        `<div style="font-size:12.5px;color:var(--dim,#9aa0ad);white-space:pre-wrap;margin-top:2px">${escHtml(f.value)}</div></div>`).join('');
      box(H('Publier sur Discord') +
        `<div style="font-size:12px;color:var(--muted,#8b90a0);margin-bottom:14px">Aperçu du message — salon « ${escHtml(channel)} »</div>` +
        `<div style="border-left:4px solid ${c};background:var(--surface-2,#12151d);border-radius:8px;padding:13px 15px">` +
        `<div style="font-weight:700;font-size:14.5px">${escHtml(embed.title || '')}</div>${fields}</div>` +
        `<div id="pzdc_msg" style="font-size:12.5px;min-height:16px;margin-top:12px;color:var(--err,#f38b8b)"></div>` +
        `<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">` +
        `<button id="pzdc_cancel" style="${_dcGhost}">Annuler</button>` +
        `<button id="pzdc_send" style="${_dcPrimary}">📢 Publier</button></div>`);
      ov.querySelector('#pzdc_cancel').onclick = close;
      ov.querySelector('#pzdc_send').onclick = async () => {
        const url = discordWebhook(channel);
        const btn = ov.querySelector('#pzdc_send'); btn.disabled = true; btn.textContent = 'Envoi…';
        try {
          await discordSend(url, { username: 'ARCHI', embeds: [embed] });
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
    mountNav, sync, status, nowTime, loadingDone,
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

  // Démarre la vérification d'accès (affiche l'overlay avant tout contenu).
  startAuth();
})();
