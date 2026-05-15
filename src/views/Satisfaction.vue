<template>
  <div class="page-wrap">
    <LoadingScreen :visible="loading" color="var(--c1)" />

    <RouterLink to="/" class="hub-link">← Hub RoZter</RouterLink>

    <div class="card" id="satisfCard">

      <!-- HEADER -->
      <div class="card-header">
        <div class="header-left">
          <div class="logo-mark">PZ</div>
          <div>
            <div class="club-name">PlaZma Esport · RoZter</div>
            <div class="doc-type">Satisfaction Joueurs</div>
          </div>
        </div>
        <div class="header-right">
          <div class="header-icon">📊</div>
          <div>
            <div class="header-sub">Sondage d'équipe</div>
            <div class="season-tag">Saison 2026</div>
          </div>
        </div>
      </div>

      <!-- SURVEY FORM -->
      <div class="card-body" v-if="!adminMode">

        <!-- PLAYER SELECT -->
        <section>
          <div class="sec-head"><div class="sec-dot" style="background:var(--c1)"></div>Qui es-tu ?</div>
          <div class="player-tabs">
            <button
              v-for="p in PLAYERS" :key="p.id"
              class="ptab"
              :class="{ active: selectedPlayer === p.id }"
              :style="selectedPlayer === p.id ? { background: p.color + '22', borderColor: p.color, color: p.color } : {}"
              @click="selectedPlayer = p.id"
            >
              {{ p.name }}<span class="ptab-role">{{ p.role }}</span>
            </button>
          </div>
        </section>

        <!-- RADIO QUESTIONS -->
        <section>
          <div class="sec-head"><div class="sec-dot" style="background:var(--c1)"></div>Évaluations (1 = Très mauvais · 5 = Excellent)</div>
          <div class="q-list">
            <div v-for="q in radioQuestions" :key="q.id" class="q-row">
              <div class="q-label">{{ q.label }}</div>
              <div class="radio-group">
                <label v-for="n in 5" :key="n" class="radio-opt" :class="{ selected: form[q.id] === n }">
                  <input type="radio" :name="q.id" :value="n" v-model="form[q.id]" />
                  <span class="radio-val">{{ n }}</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        <!-- TEXT QUESTIONS -->
        <section>
          <div class="sec-head"><div class="sec-dot" style="background:var(--yellow)"></div>Questions ouvertes</div>
          <div class="text-q-list">
            <div v-for="q in textQuestions" :key="q.id" class="field">
              <label>{{ q.label }}</label>
              <textarea v-model="form[q.id]" :placeholder="q.placeholder" rows="3"></textarea>
            </div>
          </div>
        </section>

        <!-- GLOBAL SLIDER -->
        <section>
          <div class="sec-head"><div class="sec-dot" style="background:var(--green)"></div>Score global de satisfaction</div>
          <div class="slider-block">
            <div class="slider-labels">
              <span>1 — Très insatisfait</span>
              <span>10 — Très satisfait</span>
            </div>
            <input
              type="range" min="1" max="10" step="1"
              v-model.number="form.globalScore"
              class="slider"
              :style="{ '--sc': sliderColor }"
            />
            <div class="slider-val" :style="{ color: sliderColor }">{{ form.globalScore }} / 10</div>
          </div>
        </section>

        <!-- SUBMIT -->
        <div class="submit-wrap">
          <div v-if="!selectedPlayer" class="submit-hint">Sélectionne ton pseudo pour soumettre</div>
          <button
            class="btn btn-submit"
            :disabled="!selectedPlayer || submitting"
            @click="submitSurvey"
          >
            {{ submitting ? 'Envoi…' : '✓ Soumettre ma réponse' }}
          </button>
          <div v-if="submitSuccess" class="submit-ok">Réponse enregistrée avec succès !</div>
          <div v-if="submitError" class="submit-err">Erreur lors de l'envoi. Réessaie.</div>
        </div>

        <!-- ADMIN TOGGLE -->
        <div class="admin-toggle-wrap">
          <button class="btn-mini" @click="showAdminPrompt">🔒 Accès admin</button>
        </div>

      </div>

      <!-- ADMIN PANEL -->
      <div class="card-body" v-else>
        <div class="admin-header">
          <div class="sec-head" style="margin-bottom:0;border-bottom:none;padding-bottom:0"><div class="sec-dot" style="background:var(--yellow)"></div>Résultats agrégés</div>
          <button class="btn-mini" @click="adminMode = false">← Retour au sondage</button>
        </div>
        <div class="sec-divider"></div>

        <div v-if="adminLoading" class="admin-loading">Chargement des résultats…</div>

        <div v-else>
          <div class="admin-meta">{{ submissions.length }} réponse(s) enregistrée(s) au total</div>

          <div v-for="p in PLAYERS" :key="'admin-'+p.id">
            <div v-if="submissionsByPlayer[p.id]?.length" class="player-results-block">
              <div class="player-results-title" :style="{ color: p.color }">
                {{ p.name }} — {{ submissionsByPlayer[p.id].length }} réponse(s)
              </div>

              <div class="results-grid">
                <div v-for="q in radioQuestions" :key="'r-'+p.id+'-'+q.id" class="result-item">
                  <div class="result-label">{{ q.label }}</div>
                  <div class="result-bar-wrap">
                    <div class="result-bar" :style="{ width: (avgFor(p.id, q.id) / 5 * 100) + '%', background: p.color }"></div>
                  </div>
                  <div class="result-val" :style="{ color: p.color }">{{ avgFor(p.id, q.id).toFixed(1) }} / 5</div>
                </div>
                <div class="result-item">
                  <div class="result-label">Score global de satisfaction</div>
                  <div class="result-bar-wrap">
                    <div class="result-bar" :style="{ width: (avgFor(p.id, 'globalScore') / 10 * 100) + '%', background: p.color }"></div>
                  </div>
                  <div class="result-val" :style="{ color: p.color }">{{ avgFor(p.id, 'globalScore').toFixed(1) }} / 10</div>
                </div>
              </div>

              <div v-for="q in textQuestions" :key="'t-'+p.id+'-'+q.id" class="text-results">
                <div class="text-result-label">{{ q.label }}</div>
                <div v-for="(sub, idx) in submissionsByPlayer[p.id]" :key="idx" class="text-result-entry">
                  <span class="text-result-date">{{ formatDate(sub.timestamp) }}</span>
                  <span class="text-result-val">{{ sub[q.id] || '—' }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!submissions.length" class="admin-empty">Aucune réponse pour le moment.</div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import LoadingScreen from '../components/LoadingScreen.vue'

const loading       = ref(true)
const submitting    = ref(false)
const submitSuccess = ref(false)
const submitError   = ref(false)
const selectedPlayer = ref('')
const adminMode     = ref(false)
const adminLoading  = ref(false)
const submissions   = ref([])

let unsubAdmin = null

const PLAYERS = [
  { id: 'boulou',  name: 'Boulou',  role: 'Top',     color: '#f97316' },
  { id: 'zugu',    name: 'Zugu',    role: 'Jungle',  color: '#22c55e' },
  { id: 'lakrael', name: 'Lakraël', role: 'Mid',     color: '#3b82f6' },
  { id: 'ke1do',   name: 'Ke1do',   role: 'ADC',     color: '#ef4444' },
  { id: 'joordy',  name: 'Joordy',  role: 'Support', color: '#a855f7' },
]

const radioQuestions = [
  { id: 'cohesion',     label: '1. Cohésion globale' },
  { id: 'communication',label: '2. Communication en game' },
  { id: 'atmosphere',   label: '3. Atmosphère dans l\'équipe' },
  { id: 'workload',     label: '4. Charge de travail' },
  { id: 'trainQuality', label: '5. Qualité des entraînements' },
  { id: 'coaching',     label: '6. Satisfaction du coaching' },
  { id: 'progression',  label: '7. Progression personnelle' },
  { id: 'objectives',   label: '8. Objectifs clairs' },
  { id: 'confidence',   label: '9. Confiance en soi' },
  { id: 'motivation',   label: '10. Motivation actuelle' },
]

const textQuestions = [
  { id: 'positifs',    label: '11. Points positifs',            placeholder: 'Ce qui fonctionne bien dans l\'équipe…' },
  { id: 'ameliorer',  label: '12. Points à améliorer',         placeholder: 'Ce que l\'on pourrait améliorer…' },
  { id: 'suggestions',label: '13. Suggestions pour l\'équipe', placeholder: 'Idées, propositions, pistes de travail…' },
  { id: 'msgCoach',   label: '14. Message pour le coach',      placeholder: 'Un message personnel pour le coach…' },
]

function makeDefaultForm() {
  const f = { globalScore: 5 }
  radioQuestions.forEach(q => { f[q.id] = null })
  textQuestions.forEach(q => { f[q.id] = '' })
  return f
}

const form = reactive(makeDefaultForm())

const sliderColor = computed(() => {
  const v = form.globalScore
  if (v >= 8) return 'var(--green)'
  if (v >= 5) return 'var(--yellow)'
  return 'var(--red)'
})

const submissionsByPlayer = computed(() => {
  const map = {}
  PLAYERS.forEach(p => { map[p.id] = [] })
  submissions.value.forEach(s => {
    if (map[s.player]) map[s.player].push(s)
  })
  return map
})

function avgFor(playerId, field) {
  const subs = submissionsByPlayer.value[playerId] || []
  const vals = subs.map(s => s[field]).filter(v => v != null && v !== '' && !isNaN(Number(v)))
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + Number(b), 0) / vals.length
}

function formatDate(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function submitSurvey() {
  if (!selectedPlayer.value) return
  submitting.value = true
  submitSuccess.value = false
  submitError.value = false
  try {
    const payload = {
      player: selectedPlayer.value,
      timestamp: serverTimestamp(),
    }
    radioQuestions.forEach(q => { payload[q.id] = form[q.id] })
    textQuestions.forEach(q => { payload[q.id] = form[q.id] })
    payload.globalScore = form.globalScore
    await addDoc(collection(db, 'plazma-satisfaction'), payload)
    submitSuccess.value = true
    Object.assign(form, makeDefaultForm())
    selectedPlayer.value = ''
    setTimeout(() => { submitSuccess.value = false }, 4000)
  } catch (e) {
    console.error(e)
    submitError.value = true
    setTimeout(() => { submitError.value = false }, 4000)
  } finally {
    submitting.value = false
  }
}

function showAdminPrompt() {
  const pw = prompt('Mot de passe admin :')
  if (pw === 'plazma2026') {
    adminMode.value = true
    loadSubmissions()
  } else if (pw !== null) {
    alert('Mot de passe incorrect.')
  }
}

function loadSubmissions() {
  adminLoading.value = true
  if (unsubAdmin) unsubAdmin()
  unsubAdmin = onSnapshot(collection(db, 'plazma-satisfaction'), snap => {
    submissions.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    adminLoading.value = false
  }, err => {
    console.error(err)
    adminLoading.value = false
  })
}

onMounted(() => { loading.value = false })
onUnmounted(() => { if (unsubAdmin) unsubAdmin() })
</script>

<style scoped>
.card { max-width: 860px; }
.header-right { display: flex; align-items: center; gap: 12px; }
.header-icon  { font-size: 32px; }
.header-sub   { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); }

.sec-divider { height: 1px; background: var(--bd); margin: 14px 0; }

/* Player tabs */
.player-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.ptab {
  display: flex; align-items: center; gap: 6px;
  background: var(--sf); border: 1px solid var(--bd); color: var(--tx3);
  padding: 8px 16px; font-size: 12px; font-weight: 700; letter-spacing: 1px;
  cursor: pointer; font-family: 'Exo 2', sans-serif; transition: all .18s;
  clip-path: polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%);
}
.ptab:hover { color: var(--tx2); }
.ptab-role { font-size: 9px; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; color: inherit; opacity: .7; }

/* Radio questions */
.q-list { display: flex; flex-direction: column; gap: 6px; }
.q-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  background: var(--sf); border: 1px solid var(--bd); padding: 10px 16px;
  clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%);
}
.q-label { font-size: 13px; color: var(--tx2); flex: 1; }
.radio-group { display: flex; gap: 5px; flex-shrink: 0; }
.radio-opt { display: flex; align-items: center; justify-content: center; cursor: pointer; }
.radio-opt input { display: none; }
.radio-val {
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700;
  border: 1px solid var(--bd2); color: var(--tx3); cursor: pointer;
  transition: all .15s; clip-path: polygon(4px 0%,100% 0%,calc(100% - 4px) 100%,0% 100%);
}
.radio-opt:hover .radio-val { border-color: var(--c1); color: var(--c1); }
.radio-opt.selected .radio-val { background: rgba(6,182,212,.15); border-color: var(--c1); color: var(--c1); }

/* Slider */
.slider-block { display: flex; flex-direction: column; gap: 10px; align-items: center; padding: 20px; background: var(--sf); border: 1px solid var(--bd); }
.slider-labels { display: flex; justify-content: space-between; width: 100%; max-width: 500px; font-size: 10px; color: var(--tx3); letter-spacing: 1px; }
.slider {
  width: 100%; max-width: 500px; height: 6px; cursor: pointer;
  accent-color: var(--sc, var(--c1));
  -webkit-appearance: none; appearance: none;
  background: var(--bd2); border-radius: 3px; outline: none;
}
.slider::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: var(--sc, var(--c1)); cursor: pointer; border: 2px solid #000; }
.slider-val { font-family: 'Rajdhani', sans-serif; font-size: 40px; font-weight: 700; transition: color .3s; }

/* Submit */
.submit-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 0; }
.submit-hint { font-size: 11px; color: var(--tx3); letter-spacing: 1px; }
.btn-submit {
  padding: 12px 40px; font-size: 13px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; cursor: pointer; border: none; font-family: 'Exo 2', sans-serif;
  background: var(--c1); color: #000; transition: all .2s;
  clip-path: polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%);
}
.btn-submit:hover:not(:disabled) { background: var(--c3); transform: translateY(-1px); }
.btn-submit:disabled { opacity: .4; cursor: default; transform: none; }
.submit-ok  { color: var(--green); font-size: 12px; font-weight: 700; letter-spacing: 1px; }
.submit-err { color: var(--red);   font-size: 12px; font-weight: 700; letter-spacing: 1px; }

/* Admin toggle */
.admin-toggle-wrap { text-align: center; padding-top: 8px; }

/* Admin panel */
.admin-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.admin-loading { color: var(--tx3); font-size: 13px; text-align: center; padding: 40px; }
.admin-empty   { color: var(--tx3); font-size: 13px; text-align: center; padding: 40px; }
.admin-meta    { font-size: 11px; color: var(--tx3); letter-spacing: 1px; margin-bottom: 20px; }

.player-results-block { margin-bottom: 32px; border: 1px solid var(--bd); padding: 18px; background: var(--sf2); }
.player-results-title { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 14px; }

.results-grid { display: flex; flex-direction: column; gap: 5px; margin-bottom: 18px; }
.result-item { display: flex; align-items: center; gap: 12px; background: var(--sf); border: 1px solid var(--bd); padding: 7px 14px; }
.result-label { font-size: 12px; color: var(--tx2); flex: 1; }
.result-bar-wrap { flex: 2; height: 7px; background: var(--bd2); border-radius: 4px; overflow: hidden; }
.result-bar { height: 100%; border-radius: 4px; transition: width .6s; }
.result-val { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; min-width: 60px; text-align: right; }

.text-results { margin-bottom: 12px; }
.text-result-label { font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); margin-bottom: 5px; }
.text-result-entry { display: flex; gap: 12px; background: var(--sf); border: 1px solid var(--bd); border-left: 2px solid var(--bd2); padding: 7px 12px; margin-bottom: 3px; font-size: 12px; align-items: baseline; }
.text-result-date { color: var(--tx3); white-space: nowrap; font-size: 10px; flex-shrink: 0; }
.text-result-val  { color: var(--tx2); line-height: 1.6; }

@media(max-width:640px) {
  .q-row { flex-direction: column; align-items: flex-start; }
  .radio-group { align-self: stretch; justify-content: space-between; }
  .result-item { flex-wrap: wrap; }
}
</style>
