// Test rapide du parseur sur un .rofl fourni en argument.
const { parseRofl } = require('./rofl');
const f = process.argv[2];
if (!f) { console.error('usage: node test-rofl.js <fichier.rofl>'); process.exit(1); }
const r = parseRofl(require('fs').readFileSync(f));
console.log('Durée', Math.round(r.durationSec/60)+'min · patch', r.patch);
r.players.forEach(p => console.log(` ${p.team.padEnd(4)} ${(p.pos||'-').padEnd(8)} ${p.champ.padEnd(12)} ${(p.name+'#'+p.tag).padEnd(18)} ${p.k}/${p.d}/${p.a} CS${p.cs} ${p.gold}g`));
