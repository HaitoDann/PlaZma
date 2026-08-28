'use strict';
const https = require('https');
const fs    = require('fs');

const KEY = process.env.RIOT_API_KEY;
if (!KEY) { console.error('RIOT_API_KEY manquant dans les secrets GitHub.'); process.exit(1); }

function riotGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'X-Riot-Token': KEY } }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(body));
        else reject(new Error(`HTTP ${res.statusCode} — ${body.slice(0, 120)}`));
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPlayer({ name, tag, platform, routing, role }) {
  // 1 — PUUID
  const account = await riotGet(
    `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/`
    + `${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
  );
  await sleep(250);

  // 2 — summonerId
  const summoner = await riotGet(
    `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`
  );
  await sleep(250);

  // 3 — Ranked entries
  const entries = await riotGet(
    `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summoner.id}`
  );
  const solo = entries.find(e => e.queueType === 'RANKED_SOLO_5x5') || null;

  return {
    name:  account.gameName,
    tag:   account.tagLine,
    role,
    level: summoner.summonerLevel,
    solo: solo ? {
      tier:   solo.tier,
      rank:   solo.rank,
      lp:     solo.leaguePoints,
      wins:   solo.wins,
      losses: solo.losses,
    } : null,
  };
}

async function main() {
  const { players } = JSON.parse(fs.readFileSync('player-config.json', 'utf8'));
  const results = [];

  for (const p of players) {
    try {
      process.stdout.write(`→ ${p.name}#${p.tag} … `);
      const r = await fetchPlayer(p);
      results.push(r);
      console.log(`✓ ${r.solo ? r.solo.tier + ' ' + r.solo.rank : 'Unranked'}`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
      results.push({ name: p.name, tag: p.tag, role: p.role, error: e.message });
    }
    await sleep(1100); // ~50 req/min Riot rate limit
  }

  const out = { updatedAt: new Date().toISOString(), players: results };
  fs.writeFileSync('stats-output.json', JSON.stringify(out, null, 2));
  console.log(`\n✓ stats-output.json mis à jour (${results.length} joueurs)`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
