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

  const script = document.currentScript;
  const isPublic = script && script.hasAttribute('data-public');

  // ---- Garde d'accès (cohérente sur toutes les pages) ----
  // Rappel : protection réelle = règles de sécurité Firestore.
  // Ce garde n'est qu'un filtre d'affichage côté staff.
  const page = location.pathname.split('/').pop() || 'index.html';
  if (!isPublic && page !== 'login.html') {
    if (sessionStorage.getItem('pz_auth') !== '1') {
      location.replace('login.html');
      return;
    }
  }

  // ---- Init Firebase (si le SDK est complètement chargé) ----
  // Robuste à un chargement partiel du SDK : PZ doit toujours être défini.
  let db = null;
  try {
    if (window.firebase && typeof firebase.initializeApp === 'function' && typeof firebase.firestore === 'function') {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
    }
  } catch (e) {
    console.error('Firebase indisponible :', e);
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
    { key: 'schedule',     href: 'plazma-schedule.html',    label: 'Planning' },
    { key: 'scrim',        href: 'plazma-scrim.html',       label: 'Scrim' },
    { key: 'scouting',     href: 'plazma-scouting.html',    label: 'Scouting' },
    { key: 'team',         href: 'plazma-team.html',        label: 'Équipe' },
    { key: 'dashboard',    href: 'plazma-dashboard.html',   label: 'Dashboard' },
    { key: 'coach',        href: 'plazma-coach.html',       label: 'Coach' },
    { key: 'satisfaction', href: 'plazma-satisfaction.html',label: 'Satisfaction' }
  ];

  /** Injecte la barre de navigation dans un conteneur (ou en tête de <body>). */
  function mountNav(activeKey, mountSel) {
    const links = NAV.map(n =>
      `<a href="${n.href}"${n.key === activeKey ? ' class="active"' : ''}>${n.label}</a>`
    ).join('');
    const html =
      `<div class="pz-topbar"><div class="pz-topbar-inner">
        <a class="pz-brand" href="index.html">
          <span class="pz-brand-mark"><img src="assets/logo-plazma.png" alt="ARCHI"></span>
          <span><span class="pz-brand-name">ARCHI</span></span>
        </a>
        <nav class="pz-nav">${links}</nav>
      </div></div>`;
    const host = mountSel ? document.querySelector(mountSel) : null;
    if (host) host.innerHTML = html;
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
    await new Promise(r => setTimeout(r, 60));
    const canvas = await html2canvas(el, {
      scale: 2, backgroundColor: getComputedStyle(document.body).backgroundColor,
      useCORS: true, logging: false
    });
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

  function logout() { sessionStorage.removeItem('pz_auth'); location.replace('login.html'); }

  // ---- API publique ----
  window.PZ = {
    db, COLLECTION, NAV,
    mountNav, sync, status, nowTime, loadingDone,
    exportPNG, backup, importFile, logout,
    // Roster central
    getRoster, getCoach, player, onRoster, setPlayer, saveRoster,
    ROSTER_SLOTS, COACH_SLOT
  };
})();
