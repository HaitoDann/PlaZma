<template>
  <div class="page-wrap">
    <LoadingScreen :visible="loading" label="Chargement Coach…" color="#f59e0b" />

    <div class="card-header">
      <RouterLink to="/" class="hub-link">← Hub RoZter</RouterLink>
      <div class="card-title">
        <span class="role-emoji">🎙️</span>
        <span>Coach — Évaluation</span>
      </div>
      <button class="btn-export" @click="exportPng">📷 Export PNG</button>
    </div>

    <div ref="exportRef" class="coach-card">
      <div class="coach-header">
        <div class="coach-name">Coaching Staff</div>
        <div class="global-score" :style="{ color: scoreColor }">{{ globalScore }}<span class="score-denom">/20</span></div>
      </div>

      <div class="cats-grid">
        <div v-for="cat in cats" :key="cat.id" class="cat-block">
          <div class="cat-label" :style="{ color: cat.color }">{{ cat.label }}</div>
          <div class="q-list">
            <div v-for="(q, qi) in cat.questions" :key="qi" class="q-row">
              <div class="q-text">{{ q }}</div>
              <div class="jauge-wrap">
                <div
                  v-for="n in 5"
                  :key="n"
                  class="jauge-dot"
                  :class="{ active: n <= (scores[cat.id]?.[qi] ?? 0) }"
                  :style="n <= (scores[cat.id]?.[qi] ?? 0) ? { background: cat.color } : {}"
                  @click="setScore(cat.id, qi, n)"
                ></div>
              </div>
            </div>
          </div>
          <div class="cat-score" :style="{ color: cat.color }">{{ catScore(cat.id) }}/20</div>
        </div>
      </div>

      <div class="analysis-section">
        <div class="section-title">Analyse qualitative</div>
        <div class="analysis-grid">
          <div class="analysis-block">
            <div class="analysis-label" style="color:#22c55e">✅ Points forts</div>
            <textarea
              class="analysis-area"
              v-model="analysis.strengths"
              placeholder="Points forts du coaching…"
              @input="queueSave"
            ></textarea>
          </div>
          <div class="analysis-block">
            <div class="analysis-label" style="color:#ef4444">⚠️ Axes d'amélioration</div>
            <textarea
              class="analysis-area"
              v-model="analysis.improvements"
              placeholder="Axes d'amélioration…"
              @input="queueSave"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="objectives-section">
        <div class="section-title">Objectifs Coach</div>
        <div v-for="(obj, i) in objectives" :key="i" class="obj-row">
          <input
            class="obj-input"
            v-model="objectives[i]"
            :placeholder="`Objectif ${i + 1}…`"
            @input="queueSave"
          />
        </div>
      </div>

      <div class="note-section">
        <div class="section-title">Note finale</div>
        <div class="note-row">
          <input
            type="number"
            class="note-input"
            v-model.number="finalNote"
            min="0"
            max="20"
            step="0.5"
            @input="queueSave"
          />
          <span class="note-denom">/20</span>
          <textarea
            class="note-comment"
            v-model="noteComment"
            placeholder="Commentaire final…"
            @input="queueSave"
          ></textarea>
        </div>
      </div>
    </div>

    <SyncStatus
      :state="syncState"
      :text="syncText"
      :time="syncTime"
      :flashOk="syncFlash"
      @save="forceSave"
      @backup="doBackup"
      @import="doImport"
      @reset="doReset"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { db } from '../firebase/config.js'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import html2canvas from 'html2canvas'
import LoadingScreen from '../components/LoadingScreen.vue'
import SyncStatus from '../components/SyncStatus.vue'

const DOC_ID = 'coach'

const cats = [
  {
    id: 'prep',
    label: 'Préparation & Analyse',
    color: '#06b6d4',
    questions: [
      'Analyse des replays',
      'Préparation des adversaires',
      'Mise à jour des tableaux de bord',
      'Veille méta / patch',
    ],
  },
  {
    id: 'draft',
    label: 'Draft & Stratégie',
    color: '#a855f7',
    questions: [
      'Qualité des picks/bans',
      'Vision stratégique',
      'Adaptabilité en draft',
      'Communication pre-draft',
    ],
  },
  {
    id: 'feedback',
    label: 'Coaching & Feedback',
    color: '#22c55e',
    questions: [
      'Clarté des retours',
      'Constructivité des critiques',
      'Suivi individuel',
      'Qualité des sessions VOD',
    ],
  },
  {
    id: 'leadership',
    label: 'Leadership & Groupe',
    color: '#f59e0b',
    questions: [
      'Gestion de la dynamique équipe',
      'Gestion des conflits',
      'Motivation / cohésion',
      'Communication intra-staff',
    ],
  },
  {
    id: 'perf',
    label: 'Performance en match',
    color: '#ef4444',
    questions: [
      'Réactivité in-game',
      'Adjustements tactiques',
      'Gestion du stress / tilt',
      'Bilan post-match',
    ],
  },
]

const loading = ref(true)
const scores = ref({})
const analysis = ref({ strengths: '', improvements: '' })
const objectives = ref(['', '', ''])
const finalNote = ref(null)
const noteComment = ref('')

const syncState = ref('idle')
const syncText = ref('')
const syncTime = ref('')
const syncFlash = ref(false)
let saveTimer = null
let unsub = null
const exportRef = ref(null)

function catScore(id) {
  const cat = cats.find(c => c.id === id)
  if (!cat) return 0
  const qs = cat.questions
  const total = qs.reduce((s, _, i) => s + (scores.value[id]?.[i] ?? 0), 0)
  return Math.round((total / (qs.length * 5)) * 20 * 10) / 10
}

const globalScore = computed(() => {
  const total = cats.reduce((s, c) => s + catScore(c.id), 0)
  return Math.round((total / cats.length) * 10) / 10
})

const scoreColor = computed(() => {
  const s = globalScore.value
  if (s >= 15) return '#22c55e'
  if (s >= 10) return '#f59e0b'
  return '#ef4444'
})

function setScore(catId, qi, val) {
  if (!scores.value[catId]) scores.value[catId] = {}
  const current = scores.value[catId][qi] ?? 0
  scores.value[catId][qi] = current === val ? 0 : val
  queueSave()
}

function queueSave() {
  syncState.value = 'pending'
  syncText.value = 'Modifications en attente…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(forceSave, 1500)
}

async function forceSave() {
  clearTimeout(saveTimer)
  syncState.value = 'saving'
  syncText.value = 'Sauvegarde…'
  try {
    await setDoc(doc(db, 'plazma', DOC_ID), {
      scores: scores.value,
      analysis: analysis.value,
      objectives: objectives.value,
      finalNote: finalNote.value,
      noteComment: noteComment.value,
      updatedAt: new Date().toISOString(),
    })
    syncState.value = 'ok'
    syncText.value = 'Sauvegardé'
    syncTime.value = new Date().toLocaleTimeString('fr-FR')
    syncFlash.value = true
    setTimeout(() => (syncFlash.value = false), 1000)
  } catch (e) {
    syncState.value = 'error'
    syncText.value = 'Erreur de sauvegarde'
  }
}

function doBackup() {
  const data = {
    scores: scores.value,
    analysis: analysis.value,
    objectives: objectives.value,
    finalNote: finalNote.value,
    noteComment: noteComment.value,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `coach-backup-${Date.now()}.json`
  a.click()
}

function doImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = async e => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const data = JSON.parse(text)
    scores.value = data.scores ?? {}
    analysis.value = data.analysis ?? { strengths: '', improvements: '' }
    objectives.value = data.objectives ?? ['', '', '']
    finalNote.value = data.finalNote ?? null
    noteComment.value = data.noteComment ?? ''
    await forceSave()
  }
  input.click()
}

async function doReset() {
  if (!confirm('Réinitialiser toutes les données coach ?')) return
  scores.value = {}
  analysis.value = { strengths: '', improvements: '' }
  objectives.value = ['', '', '']
  finalNote.value = null
  noteComment.value = ''
  await forceSave()
}

async function exportPng() {
  if (!exportRef.value) return
  const canvas = await html2canvas(exportRef.value, { backgroundColor: '#0f172a', scale: 2 })
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `coach-${Date.now()}.png`
  a.click()
}

onMounted(() => {
  const ref_ = doc(db, 'plazma', DOC_ID)
  unsub = onSnapshot(ref_, snap => {
    if (snap.exists()) {
      const d = snap.data()
      scores.value = d.scores ?? {}
      analysis.value = d.analysis ?? { strengths: '', improvements: '' }
      objectives.value = d.objectives ?? ['', '', '']
      finalNote.value = d.finalNote ?? null
      noteComment.value = d.noteComment ?? ''
    }
    loading.value = false
    syncState.value = 'ok'
    syncText.value = 'Synchronisé'
    syncTime.value = new Date().toLocaleTimeString('fr-FR')
  }, () => {
    loading.value = false
    syncState.value = 'error'
    syncText.value = 'Erreur de connexion'
  })
})

onUnmounted(() => {
  if (unsub) unsub()
  clearTimeout(saveTimer)
})
</script>

<style scoped>
.page-wrap { min-height: 100vh; padding: 20px; }
.card-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.hub-link { color: var(--tx2); text-decoration: none; font-size: 13px; white-space: nowrap; }
.hub-link:hover { color: var(--tx); }
.card-title { display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 2px; color: var(--tx); flex: 1; }
.role-emoji { font-size: 24px; }
.btn-export { margin-left: auto; background: var(--bg2); border: 1px solid var(--sf); color: var(--tx2); padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-export:hover { color: var(--tx); border-color: var(--c1); }

.coach-card { background: var(--bg2); border: 1px solid var(--sf); border-radius: 12px; padding: 24px; }
.coach-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.coach-name { font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700; letter-spacing: 3px; color: var(--tx); }
.global-score { font-family: 'Rajdhani', sans-serif; font-size: 48px; font-weight: 900; line-height: 1; }
.score-denom { font-size: 24px; opacity: 0.6; }

.cats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
.cat-block { background: var(--bg); border: 1px solid var(--sf); border-radius: 8px; padding: 16px; }
.cat-label { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; }
.q-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.q-row { display: flex; flex-direction: column; gap: 4px; }
.q-text { font-size: 12px; color: var(--tx2); }
.jauge-wrap { display: flex; gap: 4px; }
.jauge-dot { width: 20px; height: 8px; border-radius: 4px; background: var(--sf); cursor: pointer; transition: background 0.15s, transform 0.1s; }
.jauge-dot:hover { transform: scaleY(1.3); }
.jauge-dot.active { }
.cat-score { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; text-align: right; }

.section-title { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--tx2); margin-bottom: 12px; }
.analysis-section { margin-bottom: 20px; }
.analysis-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.analysis-block { display: flex; flex-direction: column; gap: 8px; }
.analysis-label { font-size: 12px; font-weight: 600; }
.analysis-area { background: var(--bg); border: 1px solid var(--sf); border-radius: 6px; color: var(--tx); padding: 10px; font-size: 13px; resize: vertical; min-height: 80px; font-family: inherit; }
.analysis-area:focus { outline: none; border-color: var(--c1); }

.objectives-section { margin-bottom: 20px; }
.obj-row { margin-bottom: 8px; }
.obj-input { width: 100%; background: var(--bg); border: 1px solid var(--sf); border-radius: 6px; color: var(--tx); padding: 8px 12px; font-size: 13px; font-family: inherit; box-sizing: border-box; }
.obj-input:focus { outline: none; border-color: var(--c1); }

.note-section { }
.note-row { display: flex; align-items: flex-start; gap: 12px; }
.note-input { width: 70px; background: var(--bg); border: 1px solid var(--sf); border-radius: 6px; color: var(--tx); padding: 8px 12px; font-size: 20px; font-family: 'Rajdhani', sans-serif; font-weight: 700; text-align: center; }
.note-input:focus { outline: none; border-color: var(--c1); }
.note-denom { font-family: 'Rajdhani', sans-serif; font-size: 20px; color: var(--tx2); line-height: 2.2; }
.note-comment { flex: 1; background: var(--bg); border: 1px solid var(--sf); border-radius: 6px; color: var(--tx); padding: 8px 12px; font-size: 13px; resize: vertical; min-height: 60px; font-family: inherit; }
.note-comment:focus { outline: none; border-color: var(--c1); }

@media (max-width: 600px) {
  .analysis-grid { grid-template-columns: 1fr; }
  .cats-grid { grid-template-columns: 1fr; }
}
</style>
