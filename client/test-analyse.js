// Tests hors-ligne du parseur .rofl étendu et du résumé de timeline (données synthétiques).
// Usage : node test-analyse.js
'use strict';
const assert = require('assert');
const Rofl = require('./rofl');
const Timeline = require('./timeline');

const POS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
const stats = [];
for (let i = 0; i < 10; i++) {
  const blue = i < 5;
  stats.push({
    RIOT_ID_GAME_NAME: (blue ? 'Plz' : 'Adv') + i, RIOT_ID_TAG_LINE: 'EUW', PUUID: 'puuid-' + i,
    SKIN: 'Champ' + i, TEAM: blue ? '100' : '200', TEAM_POSITION: POS[i % 5], WIN: blue ? 'Win' : 'Fail',
    CHAMPIONS_KILLED: String(blue ? 4 : 2), NUM_DEATHS: String(blue ? 2 : 4), ASSISTS: '6',
    MINIONS_KILLED: String(blue ? 200 : 180), NEUTRAL_MINIONS_KILLED: '10', NEUTRAL_MINIONS_KILLED_ENEMY_JUNGLE: '3',
    GOLD_EARNED: String(blue ? 12000 : 10000), TOTAL_DAMAGE_DEALT_TO_CHAMPIONS: String(blue ? 20000 : 15000),
    VISION_SCORE: '30', WARD_PLACED: '12', WARD_KILLED: '4', VISION_WARDS_BOUGHT_IN_GAME: '3',
    LEVEL: String(blue ? 16 : 15), EXP: String(blue ? 15000 : 13500), TOTAL_DAMAGE_TAKEN: '18000',
    TIME_CCING_OTHERS: '30', TOTAL_TIME_SPENT_DEAD: '90', ITEM0: '3031', ITEM6: '3363', PERK0: '8005',
  });
}
const meta = { gameLength: 30 * 60 * 1000, gameVersion: '15.20.1', statsJson: JSON.stringify(stats) };
const buf = Buffer.concat([Buffer.from([0x52, 0x49, 0x4f, 0x54, 0, 1, 2, 0xff, 0xfe]), Buffer.from(JSON.stringify(meta)), Buffer.from([0, 0xff, 0x7b, 0x7d])]);

// ---- parse ----
const parsed = Rofl.parse(buf, { raw: true });
assert.strictEqual(parsed.durationSec, 1800);
assert.strictEqual(parsed.players.length, 10);
const p0 = parsed.players[0];
assert.deepStrictEqual([p0.k, p0.d, p0.a, p0.cs, p0.gold, p0.pos, p0.team, p0.win], [4, 2, 6, 210, 12000, 'top', 'blue', true]);
assert.strictEqual(p0.wards, 12); assert.strictEqual(p0.pinks, 3); assert.strictEqual(p0.level, 16);
assert.deepStrictEqual(p0.items, [3031, 0, 0, 0, 0, 0, 3363]);
assert.strictEqual(parsed.raw.length, 10);
assert.strictEqual(Rofl.parseRofl, Rofl.parse);       // compat ancien nom
assert.strictEqual(Rofl.gameIdFromFile('EUW1-7234567890.rofl'), '7234567890');

// ---- derive ----
const d = Rofl.derive(parsed, 'blue');
assert.strictEqual(d.team.goldDiff, 10000);
const top = d.players[0];
assert.strictEqual(top.kp, 50);                      // (4+6)/20
assert.strictEqual(top.dmgShare, 20);
assert.strictEqual(top.csmin, 7);
assert.strictEqual(top.vs.gold, 2000);
assert.strictEqual(top.vs.cs, 20);
assert.strictEqual(top.vs.level, 1);
assert.strictEqual(top.deadPct, 5);
// Anciennes stats (11 champs seulement) : pas d'erreur, pas de champs inventés.
const old = { durationSec: 1800, side: 'blue', players: parsed.players.map(p => ({ name: p.name, champ: p.champ, pos: p.pos, team: p.team, win: p.win, k: p.k, d: p.d, a: p.a, cs: p.cs, gold: p.gold, dmg: p.dmg, vision: p.vision })) };
const dOld = Rofl.derive(old);
assert.strictEqual(dOld.players[0].wpm, undefined);
assert.strictEqual(dOld.players[0].vs.level, undefined);

// ---- aggregatePlayers ----
const agg = Rofl.aggregatePlayers([Object.assign({}, parsed, { side: 'blue' }), Object.assign({}, old)]);
assert.strictEqual(agg.length, 5);
assert.strictEqual(agg[0].n, 2);
assert.strictEqual(agg[0].avg.kp, 50);
assert.strictEqual(agg[0].vs.gold, 2000);

// ---- timeline ----
const game = { gameId: 7234567890, queueId: 0, gameType: 'CUSTOM_GAME', gameDuration: 1800, participants: [], participantIdentities: [] };
const LANES = [['TOP', 'SOLO'], ['JUNGLE', 'NONE'], ['MIDDLE', 'SOLO'], ['BOTTOM', 'DUO_CARRY'], ['BOTTOM', 'DUO_SUPPORT']];
for (let i = 1; i <= 10; i++) {
  const blue = i <= 5, l = LANES[(i - 1) % 5];
  game.participants.push({ participantId: i, teamId: blue ? 100 : 200, championId: i, spell1Id: l[0] === 'JUNGLE' ? 11 : 4, spell2Id: 7, timeline: { lane: l[0], role: l[1] } });
  game.participantIdentities.push({ participantId: i, player: { gameName: (blue ? 'Plz' : 'Adv') + (i - 1), tagLine: 'EUW', puuid: 'puuid-' + (i - 1) } });
}
const frames = [];
for (let m = 0; m <= 20; m++) {
  const pf = {};
  for (let i = 1; i <= 10; i++) pf[i] = { participantId: i, totalGold: 500 + m * (i <= 5 ? 400 : 350), xp: m * 300, level: Math.min(18, 1 + m / 2 | 0), minionsKilled: m * (i <= 5 ? 8 : 7), jungleMinionsKilled: 0, position: { x: 0, y: 0 } };
  const events = [];
  if (m === 4) events.push({ type: 'CHAMPION_KILL', timestamp: 4 * 60000 + 1000, killerId: 1, victimId: 6, assistingParticipantIds: [2], position: { x: 1000, y: 12000 } });
  if (m === 7) events.push({ type: 'ELITE_MONSTER_KILL', timestamp: 7 * 60000, killerId: 7, monsterType: 'DRAGON', monsterSubType: 'FIRE_DRAGON' });
  if (m === 12) events.push({ type: 'BUILDING_KILL', timestamp: 12 * 60000, killerId: 3, teamId: 200, buildingType: 'TOWER_BUILDING', towerType: 'OUTER_TURRET' });
  if (m === 5) events.push({ type: 'WARD_PLACED', timestamp: 5 * 60000, creatorId: 5, wardType: 'YELLOW_TRINKET' });
  frames.push({ timestamp: m * 60000 + (m ? 30 : 0), participantFrames: pf, events });
}
const sum = Timeline.summarize(game, { frames });
const t1 = sum.players.find(p => p.pid === 1);
assert.strictEqual(t1.pos, 'top');
assert.strictEqual(sum.players.find(p => p.pid === 7).pos, 'jungle');
assert.strictEqual(sum.players.find(p => p.pid === 10).pos, 'support');
assert.deepStrictEqual(t1.diff10, { gold: 500, xp: 0, cs: 10, level: 0 });
assert.deepStrictEqual(t1.diff15, { gold: 750, xp: 0, cs: 15, level: 0 });
assert.deepStrictEqual(t1.early, { k: 1, d: 0, a: 0 });
assert.strictEqual(sum.players.find(p => p.pid === 6).deaths.length, 1);
assert.deepStrictEqual(sum.firsts.blood, { team: 'blue', t: 241 });
assert.deepStrictEqual(sum.firsts.dragon, { team: 'red', t: 420 });
assert.deepStrictEqual(sum.firsts.tower, { team: 'blue', t: 720 });
assert.strictEqual(sum.players.find(p => p.pid === 5).wards.placed15, 1);
assert.strictEqual(sum.goldDiff[10], 5 * 500);
const mine = Timeline.forPlayer(sum, p => p.puuid === 'puuid-0');
assert.strictEqual(mine.diff15.gold, 750);
// Poste forcé par le .rofl de la même partie.
const sum2 = Timeline.summarize(game, { frames }, { posByName: { plz0: 'mid', plz2: 'top' } });
assert.strictEqual(sum2.players.find(p => p.pid === 1).pos, 'mid');
assert.ok(JSON.stringify(sum).length < 20000, 'résumé compact');

console.log('✓ test-analyse : parse, derive, aggregatePlayers, timeline — OK');
