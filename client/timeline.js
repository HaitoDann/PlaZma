// Timeline minute par minute d'une partie, lue APRÈS la partie via l'API locale
// du client League (LCU) — la même que pour le rang. Aucun accès au jeu.
//   /lol-match-history/v1/games/{gameId}           -> les 10 participants
//   /lol-match-history/v1/game-timelines/{gameId}  -> frames (1/min) + événements
// summarize() réduit le tout en un résumé compact (quelques Ko) envoyable à ARCHI :
// stats @10/@15 et diffs vs vis-à-vis, courbe de gold d'équipe, objectifs datés,
// premiers objectifs, morts positionnées (heatmap), wards par phase.
'use strict';

const SMITE = 11;
const MARKS = [10, 15, 20];

function teamOf(teamId) { return Number(teamId) === 200 ? 'red' : 'blue'; }

// Poste depuis lane/role (format historique du LCU) + Châtiment pour le jungler.
function guessPos(p) {
  const lane = String((p.timeline && p.timeline.lane) || '').toUpperCase();
  const role = String((p.timeline && p.timeline.role) || '').toUpperCase();
  if (p.spell1Id === SMITE || p.spell2Id === SMITE || lane === 'JUNGLE') return 'jungle';
  if (lane === 'TOP') return 'top';
  if (lane === 'MIDDLE' || lane === 'MID') return 'mid';
  if (lane === 'BOTTOM' || lane === 'BOT') return role === 'DUO_SUPPORT' ? 'support' : role === 'DUO_CARRY' ? 'adc' : '';
  return '';
}
// Postes par camp : on garde un poste seulement s'il est unique, puis on complète
// le seul poste manquant s'il ne reste qu'un joueur sans poste.
function assignPositions(players, posByName) {
  const ALL = ['top', 'jungle', 'mid', 'adc', 'support'];
  ['blue', 'red'].forEach(side => {
    const team = players.filter(p => p.team === side);
    team.forEach(p => {
      const key = String(p.name || '').toLowerCase().replace(/\s/g, '');
      p.pos = (posByName && posByName[key]) || p.guess || '';
    });
    ALL.forEach(pos => { const c = team.filter(p => p.pos === pos); if (c.length > 1) c.forEach(p => { p.pos = ''; }); });
    const free = ALL.filter(pos => !team.some(p => p.pos === pos));
    const none = team.filter(p => !p.pos);
    if (free.length === 1 && none.length === 1) none[0].pos = free[0];
  });
}

function frameAt(frames, minute) {
  const t = minute * 60000;
  let best = null;
  for (const f of frames) { if (f.timestamp <= t + 5000) best = f; else break; }
  return best && best.timestamp >= t - 65000 ? best : null;
}

// game : réponse /games/{id} ; tl : réponse /game-timelines/{id}
// opts.posByName : { pseudoNormalisé: 'top'|… } (p. ex. depuis le .rofl de la même partie)
function summarize(game, tl, opts) {
  opts = opts || {};
  const idents = {};
  (game.participantIdentities || []).forEach(x => { idents[x.participantId] = x.player || {}; });
  const players = (game.participants || []).map(p => {
    const id = idents[p.participantId] || {};
    return { pid: p.participantId, team: teamOf(p.teamId), champId: p.championId,
      name: id.gameName || id.summonerName || '', tag: id.tagLine || '', puuid: id.puuid || '', guess: guessPos(p) };
  });
  assignPositions(players, opts.posByName);
  const byPid = {}; players.forEach(p => { byPid[p.pid] = p; });
  const frames = (tl && tl.frames) || [];

  // Stats @10/@15/@20 par joueur + diffs vs vis-à-vis.
  const at = {};
  MARKS.forEach(m => {
    const f = frameAt(frames, m);
    if (!f) return;
    const row = {};
    players.forEach(p => {
      const pf = (f.participantFrames || {})[p.pid] || (f.participantFrames || {})[String(p.pid)];
      if (!pf) return;
      row[p.pid] = { gold: pf.totalGold || 0, xp: pf.xp || 0, level: pf.level || 0,
        cs: (pf.minionsKilled || 0) + (pf.jungleMinionsKilled || 0) };
    });
    at[m] = row;
  });

  // Courbe gold d'équipe (bleu - rouge) par minute.
  const goldDiff = frames.map(f => {
    let b = 0, r = 0;
    players.forEach(p => { const pf = (f.participantFrames || {})[p.pid]; if (pf) { if (p.team === 'blue') b += pf.totalGold || 0; else r += pf.totalGold || 0; } });
    return b - r;
  });

  // Événements.
  const kills = [], objectives = [], firsts = {};
  const wards = {}; players.forEach(p => { wards[p.pid] = { placed15: 0, placed: 0, killed: 0 }; });
  const early = {}; players.forEach(p => { early[p.pid] = { k: 0, d: 0, a: 0 }; });
  const setFirst = (k, team, t) => { if (!firsts[k] && team) firsts[k] = { team, t: Math.round(t / 1000) }; };
  frames.forEach(f => (f.events || []).forEach(ev => {
    const t = ev.timestamp || 0;
    switch (ev.type) {
      case 'CHAMPION_KILL': {
        const killer = byPid[ev.killerId], victim = byPid[ev.victimId];
        kills.push({ t: Math.round(t / 1000), killer: ev.killerId || 0, victim: ev.victimId || 0,
          assists: ev.assistingParticipantIds || [], x: ev.position ? ev.position.x : null, y: ev.position ? ev.position.y : null });
        if (victim) setFirst('blood', victim.team === 'blue' ? 'red' : 'blue', t);
        if (t <= 15 * 60000) {
          if (killer && early[killer.pid]) early[killer.pid].k++;
          if (victim && early[victim.pid]) early[victim.pid].d++;
          (ev.assistingParticipantIds || []).forEach(a => { if (early[a]) early[a].a++; });
        }
        break;
      }
      case 'ELITE_MONSTER_KILL': {
        const k = byPid[ev.killerId];
        const team = ev.killerTeamId ? teamOf(ev.killerTeamId) : (k ? k.team : '');
        const type = String(ev.monsterType || '').toUpperCase();
        objectives.push({ t: Math.round(t / 1000), type, sub: ev.monsterSubType || '', team });
        if (type === 'DRAGON') setFirst('dragon', team, t);
        if (type === 'RIFTHERALD') setFirst('herald', team, t);
        if (type === 'BARON_NASHOR') setFirst('baron', team, t);
        if (type === 'HORDE') setFirst('grubs', team, t);
        break;
      }
      case 'BUILDING_KILL': {
        // teamId = camp PROPRIÉTAIRE du bâtiment détruit.
        const team = ev.teamId ? (teamOf(ev.teamId) === 'blue' ? 'red' : 'blue') : '';
        const type = String(ev.buildingType || '').toUpperCase();
        objectives.push({ t: Math.round(t / 1000), type, sub: ev.towerType || ev.laneType || '', team });
        if (type === 'TOWER_BUILDING') setFirst('tower', team, t);
        if (type === 'INHIBITOR_BUILDING') setFirst('inhib', team, t);
        break;
      }
      case 'WARD_PLACED': {
        const w = wards[ev.creatorId]; if (w && String(ev.wardType || '').toUpperCase() !== 'UNDEFINED') { w.placed++; if (t <= 15 * 60000) w.placed15++; }
        break;
      }
      case 'WARD_KILL': { const w = wards[ev.killerId]; if (w) w.killed++; break; }
    }
  }));

  // Résumé par joueur.
  const out = players.map(p => {
    const o = { pid: p.pid, team: p.team, pos: p.pos, champId: p.champId, name: p.name, tag: p.tag, puuid: p.puuid,
      early: early[p.pid], wards: wards[p.pid] };
    const opp = p.pos ? players.find(e => e.team !== p.team && e.pos === p.pos) : null;
    MARKS.forEach(m => {
      const row = at[m]; if (!row || !row[p.pid]) return;
      o['at' + m] = row[p.pid];
      if (opp && row[opp.pid]) {
        const a = row[p.pid], b = row[opp.pid];
        o['diff' + m] = { gold: a.gold - b.gold, xp: a.xp - b.xp, cs: a.cs - b.cs, level: a.level - b.level };
      }
    });
    o.deaths = kills.filter(k => k.victim === p.pid).map(k => ({ t: k.t, x: k.x, y: k.y }));
    return o;
  });

  return { v: 1, gameId: game.gameId, queueId: game.queueId, gameMode: game.gameMode || '', gameType: game.gameType || '',
    durationSec: game.gameDuration || 0, ts: game.gameCreation || 0,
    players: out, goldDiff, objectives, firsts, kills: kills.length };
}

// Vue « un joueur » (pour l'historique SoloQ) : ses diffs + les premiers objectifs.
function forPlayer(sum, match) {
  const me = sum.players.find(p => match(p));
  if (!me) return null;
  return { pos: me.pos, team: me.team, diff10: me.diff10 || null, diff15: me.diff15 || null, at15: me.at15 || null,
    early: me.early, wards: me.wards, firsts: sum.firsts, deaths: me.deaths.length };
}

module.exports = { summarize, forPlayer, guessPos, assignPositions };
