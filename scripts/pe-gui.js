// Bascule un .exe Windows du sous-système « console » (3) au sous-système
// « GUI » (2) : plus de fenêtre de terminal à l'exécution. Usage : node pe-gui.js <exe>
const fs = require('fs');
const file = process.argv[2];
if (!file) { console.error('usage: node pe-gui.js <exe>'); process.exit(1); }
const b = fs.readFileSync(file);
if (b.readUInt16LE(0) !== 0x5A4D) { console.error('pas un exe (MZ)'); process.exit(1); }
const pe = b.readUInt32LE(0x3C);                 // offset de la signature PE
if (b.toString('ascii', pe, pe + 4) !== 'PE\0\0') { console.error('signature PE introuvable'); process.exit(1); }
const subOff = pe + 4 + 20 + 68;                 // PE sig + COFF(20) + Optional header offset 68
const cur = b.readUInt16LE(subOff);
if (cur === 2) { console.log('déjà en GUI'); process.exit(0); }
if (cur !== 3) { console.error('sous-système inattendu :', cur); process.exit(1); }
b.writeUInt16LE(2, subOff);
fs.writeFileSync(file, b);
console.log('sous-système basculé console→GUI (fenêtre masquée).');
