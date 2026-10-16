// Tests des règles Firestore (émulateur). Lancer : npm run test:rules
import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-archi',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin'), { role: 'admin', disabled: false });
    await setDoc(doc(db, 'users/staff'), { role: 'staff', disabled: false, sections: { scrim: 'edit', scouting: 'view' } });
    await setDoc(doc(db, 'users/off'), { role: 'admin', disabled: true });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const as = uid => env.authenticatedContext(uid).firestore();

const playerSurvey = (over = {}) => ({
  pseudo: 'Joueur', playerId: 'top', playerEmoji: '🛡️', q2_ecoute: 'Oui', q3_tensions: '',
  q4_ambiance: 4, q5_motivation: 5, q6_fatigue: 2, q7_entrainement: 4, q8_charge: 'Correct',
  criteria: { com: 3 }, q9_domaines: ['Macro'], q10_direction: 'Oui', q11_objectif: '',
  q12_staff: ['Analyste'], q13_note: 8, q14_suggestion: 'RAS', q15_haito: 'Top',
  submittedAt: serverTimestamp(), date: '16/10/2026', ...over,
});
const coachSurvey = (over = {}) => ({
  coach: 'Coach', coachEmoji: '♟️', bMotiv: 4, bFatigue: 3, bTemps: 3, bProg: 4,
  equilibre: 'Bon', charge: 'Correcte', direction: 'Oui', besoins: ['Rien'], criteria: { ambiance: 4 },
  note: 7, frein: '', besoin: '', libre: 'Merci', submittedAt: serverTimestamp(), date: '16/10/2026', ...over,
});

test('questionnaire joueur : soumission anonyme valide acceptée', () =>
  assertSucceeds(addDoc(collection(anon(), 'plazma-satisfaction'), playerSurvey())));
test('questionnaire joueur : champ inconnu refusé', () =>
  assertFails(addDoc(collection(anon(), 'plazma-satisfaction'), playerSurvey({ evil: '<script>' }))));
test('questionnaire joueur : texte trop long refusé', () =>
  assertFails(addDoc(collection(anon(), 'plazma-satisfaction'), playerSurvey({ q14_suggestion: 'x'.repeat(5000) }))));
test('questionnaire joueur : note hors bornes refusée', () =>
  assertFails(addDoc(collection(anon(), 'plazma-satisfaction'), playerSurvey({ q13_note: 99 }))));
test('questionnaire joueur : type invalide refusé', () =>
  assertFails(addDoc(collection(anon(), 'plazma-satisfaction'), playerSurvey({ q2_ecoute: { x: 1 } }))));
test('questionnaire joueur : date serveur falsifiée refusée', () =>
  assertFails(addDoc(collection(anon(), 'plazma-satisfaction'), playerSurvey({ submittedAt: new Date(0) }))));
test('questionnaire joueur : identifiant de document forgé refusé', () =>
  assertFails(setDoc(doc(anon(), "plazma-satisfaction/x');alert(1);(' "), playerSurvey())));
test('questionnaire joueur : lecture anonyme refusée', () =>
  assertFails(getDoc(doc(anon(), 'plazma-satisfaction/x'))));
test('questionnaire coach : soumission valide acceptée', () =>
  assertSucceeds(addDoc(collection(anon(), 'plazma-satisfaction-coach'), coachSurvey())));
test('questionnaire coach : champ inconnu refusé', () =>
  assertFails(addDoc(collection(anon(), 'plazma-satisfaction-coach'), coachSurvey({ x: 1 }))));

test('_usage : compteur du jour + sa propre présence acceptés', () =>
  assertSucceeds(setDoc(doc(as('staff'), 'plazma/_usage'),
    { '2026-10-16': { reads: 3 }, perUser: { staff: { name: 'S', last: 1 } } }, { merge: true })));
test('_usage : modifier la présence d\'un autre refusé', () =>
  assertFails(setDoc(doc(as('staff'), 'plazma/_usage'), { perUser: { admin: { name: 'X' } } }, { merge: true })));
test('_usage : écraser plusieurs clés refusé', () =>
  assertFails(setDoc(doc(as('staff'), 'plazma/_usage'), { a: 1, b: 2 }, { merge: true })));
test('_usage : anonyme refusé', () =>
  assertFails(setDoc(doc(anon(), 'plazma/_usage'), { '2026-10-16': {} }, { merge: true })));

test('sections : edit scrim permet d\'écrire', () =>
  assertSucceeds(setDoc(doc(as('staff'), 'plazma-scrims/s1'), { a: 1 })));
test('sections : view scouting interdit d\'écrire', () =>
  assertFails(setDoc(doc(as('staff'), 'plazma-scouting/s1'), { a: 1 })));
test('sections : view scouting permet de lire', () =>
  assertSucceeds(getDoc(doc(as('staff'), 'plazma-scouting/s1'))));
test('compte désactivé : tout refusé', () =>
  assertFails(getDoc(doc(as('off'), 'plazma-scrims/s1'))));
test('users : un membre ne peut pas se promouvoir admin', () =>
  assertFails(setDoc(doc(as('staff'), 'users/staff'), { role: 'admin' }, { merge: true })));
