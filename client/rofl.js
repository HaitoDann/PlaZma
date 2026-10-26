/* Parseur .rofl + analyse (partagé client ARCHI Link / site ARCHI).
   ⚠ Ce fichier existe en deux exemplaires IDENTIQUES :
       client/rofl.js            (Node : require('./rofl'))
       assets/rofl-browser.js    (navigateur : window.Rofl)
   Après modification, recopier l'un sur l'autre (`npm run check:rofl` dans client/ le vérifie).

   On lit l'objet de métadonnées UTF-8 embarqué (statsJson), sans le client
   League et sans déchiffrer la partie : ce sont les stats de FIN de partie
   des 10 joueurs. Pas de timeline ici (voir client/timeline.js).

   API :
     parse(buf, {raw})      -> { durationSec, patch, players:[…] } (+ raw:[statsJson brut] si raw)
     derive(st, side)       -> stats dérivées par joueur du camp `side` (ratios, parts d'équipe, diffs vs vis-à-vis)
     aggregatePlayers(sts)  -> moyennes par joueur sur plusieurs games ({side} renseigné dans chaque st)
     gameIdFromFile(name)   -> gameId depuis "EUW1-1234567890.rofl"
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Rofl = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normPos(v) {
    v = String(v || '').toUpperCase();
    if (v === 'TOP') return 'top';
    if (v === 'JUNGLE') return 'jungle';
    if (v === 'MIDDLE' || v === 'MID') return 'mid';
    if (v === 'BOTTOM' || v === 'BOT' || v === 'ADC' || v === 'DUO_CARRY') return 'adc';
    if (v === 'UTILITY' || v === 'SUPPORT' || v === 'DUO_SUPPORT') return 'support';
    return '';
  }

  // Extrait l'objet JSON { ... } à partir de l'accolade ouvrante, en respectant
  // les chaînes (les accolades de statsJson sont dans une chaîne échappée).
  function extractBalanced(str, start) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < str.length; i++) {
      const c = str[i];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
      else { if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { if (--depth === 0) return str.slice(start, i + 1); } }
    }
    return null;
  }

  // Champs numériques conservés : clé courte ARCHI -> clé(s) statsJson (la première présente gagne).
  const NUM_FIELDS = {
    level: ['LEVEL'], xp: ['EXP'],
    csLane: ['MINIONS_KILLED'], csJgl: ['NEUTRAL_MINIONS_KILLED'],
    csJglAlly: ['NEUTRAL_MINIONS_KILLED_YOUR_JUNGLE'], csJglEnemy: ['NEUTRAL_MINIONS_KILLED_ENEMY_JUNGLE'],
    goldSpent: ['GOLD_SPENT'],
    dmgPhys: ['PHYSICAL_DAMAGE_DEALT_TO_CHAMPIONS'], dmgMagic: ['MAGIC_DAMAGE_DEALT_TO_CHAMPIONS'], dmgTrue: ['TRUE_DAMAGE_DEALT_TO_CHAMPIONS'],
    dmgTotal: ['TOTAL_DAMAGE_DEALT'],
    dmgTaken: ['TOTAL_DAMAGE_TAKEN'], dmgMitigated: ['TOTAL_DAMAGE_SELF_MITIGATED'],
    dmgBuildings: ['TOTAL_DAMAGE_DEALT_TO_BUILDINGS'], dmgTurrets: ['TOTAL_DAMAGE_DEALT_TO_TURRETS'],
    dmgObjectives: ['TOTAL_DAMAGE_DEALT_TO_OBJECTIVES'],
    heal: ['TOTAL_HEAL'], healAllies: ['TOTAL_HEAL_ON_TEAMMATES'], shieldAllies: ['TOTAL_DAMAGE_SHIELDED_ON_TEAMMATES'],
    ccTime: ['TIME_CCING_OTHERS'], ccDealt: ['TOTAL_TIME_CROWD_CONTROL_DEALT'],
    wards: ['WARD_PLACED'], wardsKilled: ['WARD_KILLED'], pinks: ['VISION_WARDS_BOUGHT_IN_GAME'],
    turrets: ['TURRETS_KILLED'], inhibs: ['BARRACKS_KILLED'],
    dragons: ['DRAGON_KILLS'], barons: ['BARON_KILLS'], heralds: ['RIFT_HERALD_KILLS'], grubs: ['HORDE_KILLS'],
    deadTime: ['TOTAL_TIME_SPENT_DEAD'], longestLife: ['LONGEST_TIME_SPENT_LIVING'],
    multiKill: ['LARGEST_MULTI_KILL'], spree: ['LARGEST_KILLING_SPREE'], critMax: ['LARGEST_CRITICAL_STRIKE'],
    doubles: ['DOUBLE_KILLS'], triples: ['TRIPLE_KILLS'], quadras: ['QUADRA_KILLS'], pentas: ['PENTA_KILLS'],
    q: ['SPELL1_CAST'], w: ['SPELL2_CAST'], e: ['SPELL3_CAST'], r: ['SPELL4_CAST'],
    sum1Casts: ['SUMMON_SPELL1_CAST'], sum2Casts: ['SUMMON_SPELL2_CAST'],
    keystone: ['KEYSTONE_ID', 'PERK0'], runePrimary: ['PERK_PRIMARY_STYLE'], runeSub: ['PERK_SUB_STYLE'],
  };

  function parse(buf, opts) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    let kw = text.indexOf('"gameLength"');
    if (kw < 0) kw = text.indexOf('"statsJson"');
    if (kw < 0) throw new Error('métadonnées introuvables');
    const open = text.lastIndexOf('{', kw);
    if (open < 0) throw new Error('métadonnées illisibles');
    const metaStr = extractBalanced(text, open);
    if (!metaStr) throw new Error('métadonnées incomplètes');
    const meta = JSON.parse(metaStr);
    const rawStats = typeof meta.statsJson === 'string' ? JSON.parse(meta.statsJson) : meta.statsJson;
    if (!Array.isArray(rawStats) || !rawStats.length) throw new Error('aucune stat joueur');
    const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
    const has = (p, k) => p[k] !== undefined && p[k] !== null && p[k] !== '';
    const players = rawStats.map(p => {
      const o = {
        name: (p.RIOT_ID_GAME_NAME || p.NAME || '').trim(),
        tag: (p.RIOT_ID_TAG_LINE || '').trim(),
        puuid: p.PUUID || '',
        champ: p.SKIN || '—',
        pos: normPos(p.TEAM_POSITION || p.INDIVIDUAL_POSITION || p.POSITION || p.LANE || ''),
        team: String(p.TEAM) === '200' ? 'red' : 'blue',
        win: /^win$/i.test(p.WIN || ''),
        k: num(p.CHAMPIONS_KILLED), d: num(p.NUM_DEATHS), a: num(p.ASSISTS),
        cs: num(p.MINIONS_KILLED) + num(p.NEUTRAL_MINIONS_KILLED),
        gold: num(p.GOLD_EARNED),
        dmg: num(p.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS),
        vision: num(p.VISION_SCORE),
      };
      for (const key in NUM_FIELDS) {
        const src = NUM_FIELDS[key].find(k => has(p, k));
        if (src) o[key] = num(p[src]);
      }
      const items = [0, 1, 2, 3, 4, 5, 6].map(i => num(p['ITEM' + i]));
      if (items.some(Boolean)) o.items = items;
      const perks = [0, 1, 2, 3, 4, 5].map(i => num(p['PERK' + i]));
      if (perks.some(Boolean)) o.perks = perks;
      const s1 = num(p.SUMMONER_SPELL_1 || p.SUMMONER_SPELL1), s2 = num(p.SUMMONER_SPELL_2 || p.SUMMONER_SPELL2);
      if (s1 || s2) o.spells = [s1, s2];
      return o;
    });
    const out = { durationSec: Math.round(num(meta.gameLength) / 1000), patch: meta.gameVersion || '', players };
    if (opts && opts.raw) out.raw = rawStats;
    return out;
  }

  // ---- Analyse ----
  const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
  const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : null;
  const sum = (arr, f) => arr.reduce((m, p) => m + (+p[f] || 0), 0);
  const val = (p, f) => (p && typeof p[f] === 'number') ? p[f] : null;

  // Vis-à-vis : même poste dans le camp d'en face (poste unique des deux côtés).
  function opponentOf(p, them) {
    if (!p.pos) return null;
    const c = them.filter(e => e.pos === p.pos);
    return c.length === 1 ? c[0] : null;
  }

  // st = { durationSec, players, side }. Renvoie { min, team:{…}, players:[{name, champ, pos, …ratios, vs:{…}}] }.
  function derive(st, side) {
    side = side || st.side || 'blue';
    const us = (st.players || []).filter(p => p.team === side);
    const them = (st.players || []).filter(p => p.team !== side);
    const min = (st.durationSec || 0) / 60 || 1;
    const T = { k: sum(us, 'k'), d: sum(us, 'd'), gold: sum(us, 'gold'), dmg: sum(us, 'dmg'), cs: sum(us, 'cs'),
      vision: sum(us, 'vision'), dmgTaken: sum(us, 'dmgTaken') };
    const E = { k: sum(them, 'k'), gold: sum(them, 'gold'), dmg: sum(them, 'dmg'), cs: sum(them, 'cs'), vision: sum(them, 'vision') };
    const players = us.map(p => {
      const o = {
        name: p.name, tag: p.tag, champ: p.champ, pos: p.pos, win: p.win,
        k: p.k, d: p.d, a: p.a,
        kda: r2((p.k + p.a) / Math.max(1, p.d)),
        kp: pct(p.k + p.a, T.k), deathShare: pct(p.d, T.d),
        dmgShare: pct(p.dmg, T.dmg), goldShare: pct(p.gold, T.gold),
        dmgPerGold: p.gold ? r2(p.dmg / p.gold) : null,
        csmin: r1(p.cs / min), gpm: Math.round(p.gold / min), dpm: Math.round(p.dmg / min),
        vspm: r2(p.vision / min),
      };
      if (val(p, 'wards') != null) o.wpm = r2(p.wards / min);
      if (val(p, 'wardsKilled') != null) o.wkpm = r2(p.wardsKilled / min);
      if (val(p, 'pinks') != null) o.pinks = p.pinks;
      if (val(p, 'dmgTaken') != null) o.tankShare = pct(p.dmgTaken, T.dmgTaken);
      if (val(p, 'dmgMitigated') != null) o.mitigatedPm = Math.round(p.dmgMitigated / min);
      if (val(p, 'ccTime') != null) o.ccpm = r2(p.ccTime / min);
      if (val(p, 'healAllies') != null || val(p, 'shieldAllies') != null)
        o.supportPm = Math.round(((p.healAllies || 0) + (p.shieldAllies || 0)) / min);
      if (val(p, 'deadTime') != null) o.deadPct = pct(p.deadTime, st.durationSec || 0);
      if (val(p, 'dmgObjectives') != null) o.objPm = Math.round(p.dmgObjectives / min);
      if (val(p, 'csJglEnemy') != null) o.csJglEnemy = p.csJglEnemy;
      const e = opponentOf(p, them);
      if (e) {
        o.vs = { champ: e.champ, name: e.name,
          gold: p.gold - e.gold, cs: p.cs - e.cs, dmg: p.dmg - e.dmg, vision: p.vision - e.vision,
          kills: p.k - e.k, deaths: p.d - e.d };
        if (val(p, 'level') != null && val(e, 'level') != null) o.vs.level = p.level - e.level;
        if (val(p, 'xp') != null && val(e, 'xp') != null) o.vs.xp = p.xp - e.xp;
      }
      return o;
    });
    const team = { win: !!(us[0] && us[0].win), goldDiff: T.gold - E.gold, csDiff: T.cs - E.cs, dmgDiff: T.dmg - E.dmg,
      visionDiff: T.vision - E.vision, kills: T.k, deaths: T.d, csmin: r1(T.cs / min), durationSec: st.durationSec || 0 };
    return { min, team, players };
  }

  // Moyennes par joueur (clé : pseudo normalisé) sur une liste de games { …st, side }.
  const AVG_KEYS = ['k', 'd', 'a', 'kp', 'deathShare', 'dmgShare', 'goldShare', 'dmgPerGold', 'csmin', 'gpm', 'dpm', 'vspm',
    'wpm', 'wkpm', 'pinks', 'tankShare', 'mitigatedPm', 'ccpm', 'supportPm', 'deadPct', 'objPm', 'csJglEnemy'];
  const VS_KEYS = ['gold', 'cs', 'dmg', 'vision', 'level', 'xp'];
  function aggregatePlayers(sts) {
    const by = {};
    (sts || []).forEach(st => {
      if (!st || !Array.isArray(st.players) || !st.side) return;
      derive(st, st.side).players.forEach(p => {
        const id = String(p.name || '?').toLowerCase().replace(/\s/g, '');
        const a = by[id] || (by[id] = { name: p.name, pos: {}, champs: {}, n: 0, wins: 0, s: {}, c: {}, vs: {}, vc: {} });
        a.n++; if (p.win) a.wins++;
        if (p.pos) a.pos[p.pos] = (a.pos[p.pos] || 0) + 1;
        a.champs[p.champ] = (a.champs[p.champ] || 0) + 1;
        AVG_KEYS.forEach(k => { if (typeof p[k] === 'number') { a.s[k] = (a.s[k] || 0) + p[k]; a.c[k] = (a.c[k] || 0) + 1; } });
        if (p.vs) VS_KEYS.forEach(k => { if (typeof p.vs[k] === 'number') { a.vs[k] = (a.vs[k] || 0) + p.vs[k]; a.vc[k] = (a.vc[k] || 0) + 1; } });
      });
    });
    return Object.values(by).map(a => {
      const avg = {}; Object.keys(a.s).forEach(k => { avg[k] = r2(a.s[k] / a.c[k]); });
      const vs = {}; Object.keys(a.vs).forEach(k => { vs[k] = Math.round(a.vs[k] / a.vc[k]); });
      const pos = Object.keys(a.pos).sort((x, y) => a.pos[y] - a.pos[x])[0] || '';
      avg.kda = r2(((a.s.k || 0) + (a.s.a || 0)) / Math.max(1, a.s.d || 0));
      return { name: a.name, pos, n: a.n, wins: a.wins, champs: a.champs, avg, vs };
    }).sort((x, y) => y.n - x.n);
  }

  function gameIdFromFile(name) {
    const m = String(name || '').match(/(\d{6,})\.rofl$/i);
    return m ? m[1] : '';
  }

  return { parse, parseRofl: parse, normPos, derive, aggregatePlayers, gameIdFromFile, opponentOf };
});
