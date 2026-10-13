/* Parseur .rofl côté navigateur (partagé). window.Rofl.parse(ArrayBuffer)
   -> { durationSec, patch, players:[{name,tag,champ,pos,team,win,k,d,a,cs,gold,dmg,vision}] }
   Lit l'objet de métadonnées UTF-8 embarqué (statsJson) sans toucher au binaire. */
(function () {
  function normPos(v) {
    v = String(v || '').toUpperCase();
    if (v === 'TOP') return 'top';
    if (v === 'JUNGLE') return 'jungle';
    if (v === 'MIDDLE' || v === 'MID') return 'mid';
    if (v === 'BOTTOM' || v === 'BOT' || v === 'ADC' || v === 'DUO_CARRY') return 'adc';
    if (v === 'UTILITY' || v === 'SUPPORT' || v === 'DUO_SUPPORT') return 'support';
    return '';
  }
  function extractBalanced(str, start) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < str.length; i++) {
      const c = str[i];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
      else { if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { if (--depth === 0) return str.slice(start, i + 1); } }
    }
    return null;
  }
  function parse(buf) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buf));
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
    const players = rawStats.map(p => ({
      name: (p.RIOT_ID_GAME_NAME || p.NAME || '').trim(),
      tag: (p.RIOT_ID_TAG_LINE || '').trim(),
      champ: p.SKIN || '—',
      pos: normPos(p.TEAM_POSITION || p.INDIVIDUAL_POSITION || p.POSITION || p.LANE || ''),
      team: String(p.TEAM) === '200' ? 'red' : 'blue',
      win: /^win$/i.test(p.WIN || ''),
      k: num(p.CHAMPIONS_KILLED), d: num(p.NUM_DEATHS), a: num(p.ASSISTS),
      cs: num(p.MINIONS_KILLED) + num(p.NEUTRAL_MINIONS_KILLED),
      gold: num(p.GOLD_EARNED),
      dmg: num(p.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS),
      vision: num(p.VISION_SCORE),
    }));
    return { durationSec: Math.round(num(meta.gameLength) / 1000), patch: meta.gameVersion || '', players };
  }
  window.Rofl = { parse: parse, normPos: normPos };
})();
