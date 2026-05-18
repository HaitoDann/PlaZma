<template>
  <div class="page-wrap">
    <LoadingScreen :visible="loading" label="Chargement Coach…" color="#f59e0b" />

    <div class="toolbar">
      <button class="btn btn-export" :disabled="exporting" @click="exportPng">
        {{ exporting ? 'Export…' : '⬇ Exporter PNG' }}
      </button>
    </div>

    <SyncStatus
      :state="syncState"
      :text="syncText"
      :time="syncTime"
      :flash-ok="syncFlash"
      @save="forceSave"
      @backup="doBackup"
      @import="doImport"
      @reset="doReset"
    />

    <div ref="exportRef" class="card" id="coachCard">

      <!-- HEADER -->
      <div class="card-header">
        <div class="header-left">
          <div class="logo-mark">PZ</div>
          <div>
            <div class="club-name">PlaZma Esport · RoZter</div>
            <div class="doc-type">Fiche Coach</div>
          </div>
        </div>
        <div class="header-right">
          <Trophy :size="32" style="color:var(--yellow);opacity:0.8" />
          <div>
            <div class="header-sub">Évaluation du Staff Technique</div>
            <div class="season-tag">Saison 2026</div>
          </div>
        </div>
      </div>

      <!-- META -->
      <div class="meta-bar">
        <div class="meta-lbl">Évaluateur</div>
        <input class="meta-inp" v-model="form.eval" type="text" placeholder="Manager / Capitaine" @input="queueSave">
        <div class="meta-lbl" style="margin-left:24px">Période</div>
        <input class="meta-inp" v-model="form.period" type="text" placeholder="ex: Semaine 12 – Avril 2026" @input="queueSave" style="max-width:260px">
      </div>

      <!-- SCORE GLOBAL -->
      <div class="score-band">
        <div class="score-left">
          <div style="display:flex;align-items:baseline;gap:6px">
            <div class="score-num" :style="{ color: scoreColor }">{{ globalScore > 0 ? globalScore.toFixed(1) : '—' }}</div>
            <div class="score-denom">/ 20</div>
          </div>
          <div class="score-lbl">Score global</div>
        </div>
        <div class="score-right">
          <div class="score-qual" :style="{ color: scoreColor }">{{ scoreLabel }}</div>
          <div class="score-track">
            <div class="score-fill" :style="{ width: (globalScore / 20 * 100) + '%', background: scoreColor }"></div>
          </div>
          <div class="cat-pills">
            <div
              v-for="cat in cats" :key="cat.id"
              class="cp"
              :style="{ background: cat.color + '14', color: cat.color, border: `1px solid ${cat.color}28` }"
            >{{ cat.label.split(' ')[0] }} · {{ catScore(cat.id) }}</div>
          </div>
        </div>
      </div>

      <!-- BODY -->
      <div class="card-body">

        <!-- CATÉGORIES -->
        <div>
          <div class="sec-head">
            <div class="sec-dot" style="background:var(--yellow)"></div>
            Évaluation par catégorie (0 – 5)
          </div>

          <div v-for="cat in cats" :key="cat.id" class="cat-block">
            <div class="cat-label" :style="{ color: cat.color }">{{ cat.label }}</div>
            <div class="jauge-list">
              <div
                v-for="(q, qi) in cat.questions"
                :key="qi"
                class="jr"
                :style="{ '--jc': cat.color + '55' }"
              >
                <div class="jr-label">
                  <strong>{{ q.title }}</strong>
                  <small>{{ q.hint }}</small>
                </div>
                <div class="jr-dots">
                  <div
                    v-for="n in 5" :key="n"
                    class="jd"
                    :class="{ on: (scores[cat.id]?.[qi] ?? 0) >= n }"
                    :style="{ background: cat.color }"
                    @click="setScore(cat.id, qi, n)"
                  ></div>
                </div>
                <div class="jr-num" :style="{ color: (scores[cat.id]?.[qi] ?? 0) ? cat.color : 'var(--tx3)' }">
                  {{ scores[cat.id]?.[qi] ?? 0 }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ANALYSE -->
        <div>
          <div class="sec-head"><div class="sec-dot" style="background:var(--green)"></div>Analyse qualitative</div>
          <div class="obs-grid" style="margin-bottom:9px">
            <div class="obs-card" style="border-left:2px solid var(--green)">
              <div class="obs-lbl" style="color:var(--green)">✦ Points forts</div>
              <textarea class="obs-ta" v-model="analysis.strengths" placeholder="Forces identifiées avec exemples concrets…" @input="queueSave"></textarea>
            </div>
            <div class="obs-card" style="border-left:2px solid var(--red)">
              <div class="obs-lbl" style="color:var(--red)">✦ Axes d'amélioration</div>
              <textarea class="obs-ta" v-model="analysis.improvements" placeholder="Points à travailler, erreurs récurrentes…" @input="queueSave"></textarea>
            </div>
          </div>
          <div class="obs-full" style="border-left:2px solid var(--c1)">
            <div class="obs-lbl" style="color:var(--c1)">✦ Observations générales</div>
            <textarea class="obs-ta" v-model="analysis.obs" placeholder="Comportement général, communication, régularité, attitude staff…" @input="queueSave"></textarea>
          </div>
        </div>

        <!-- OBJECTIFS -->
        <div>
          <div class="sec-head"><div class="sec-dot" style="background:var(--c1)"></div>Objectifs pour la prochaine période</div>
          <div class="obj-list-perf">
            <div v-for="(_, i) in 3" :key="i" class="obj-row">
              <div class="obj-n">0{{ i + 1 }}</div>
              <input
                class="obj-inp"
                v-model="objectives[i]"
                type="text"
                :placeholder="objPlaceholders[i]"
                @input="queueSave"
              >
            </div>
          </div>
        </div>

        <!-- NOTE FINALE -->
        <div class="note-block">
          <div class="nb-wrap">
            <input
              class="nb-inp"
              v-model="finalNote"
              type="number"
              min="0" max="20"
              placeholder="—"
              @input="queueSave"
              style="color:var(--yellow);border-bottom-color:rgba(245,158,11,.25);text-shadow:0 0 20px rgba(245,158,11,.4)"
            >
            <div class="nb-over">/ 20</div>
          </div>
          <div class="nb-right">
            <div class="nb-lbl" style="color:var(--yellow)">Note finale</div>
            <input class="nb-comment" v-model="noteComment" type="text" placeholder="Commentaire libre…" @input="queueSave">
            <div class="nb-scale">0–8 · Insuffisant &nbsp;|&nbsp; 9–12 · Correct &nbsp;|&nbsp; 13–16 · Bon &nbsp;|&nbsp; 17–20 · Excellent</div>
          </div>
        </div>

      </div>

      <!-- FOOTER -->
      <div class="card-footer">
        <div class="footer-brand">PlaZma Esport · RoZter · plazma-esport.fr</div>
        <div class="footer-sigs">
          <div class="sig"><div class="sig-line"></div><div class="sig-label">Coach</div></div>
          <div class="sig"><div class="sig-line"></div><div class="sig-label">Manager</div></div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { db } from '../firebase/config.js'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import html2canvas from 'html2canvas'
import { Trophy } from 'lucide-vue-next'
import LoadingScreen from '../components/LoadingScreen.vue'
import SyncStatus from '../components/SyncStatus.vue'

const DOC_ID = 'coach'

const cats = [
  {
    id: 'prep',
    label: 'Préparation & Analyse',
    color: '#06b6d4',
    questions: [
      { title: 'Analyse des replays',              hint: 'Fréquence et profondeur des VOD reviews' },
      { title: 'Préparation adversaires',          hint: 'Scouting des équipes et joueurs ennemis' },
      { title: 'Suivi des tableaux de bord',       hint: 'Stats, ELO, KPI – tenue à jour' },
      { title: 'Veille méta / patch',              hint: 'Adaptation aux changements de patch' },
    ],
  },
  {
    id: 'draft',
    label: 'Draft & Stratégie',
    color: '#a855f7',
    questions: [
      { title: 'Qualité des picks/bans',           hint: 'Pertinence et cohérence des choix B/P' },
      { title: 'Vision stratégique',               hint: 'Cohérence du plan de jeu global' },
      { title: 'Adaptabilité en draft',            hint: 'Réponse aux picks et bans adverses' },
      { title: 'Communication pre-draft',          hint: 'Briefing et préparation de l\'équipe' },
    ],
  },
  {
    id: 'feedback',
    label: 'Coaching & Feedback',
    color: '#22c55e',
    questions: [
      { title: 'Clarté des retours',               hint: 'Compréhension des axes de progression' },
      { title: 'Constructivité des critiques',     hint: 'Ton, bienveillance et précision' },
      { title: 'Suivi individuel',                 hint: 'Accompagnement personnalisé par joueur' },
      { title: 'Qualité des sessions VOD',         hint: 'Structure et efficacité des reviews' },
    ],
  },
  {
    id: 'leadership',
    label: 'Leadership & Groupe',
    color: '#f59e0b',
    questions: [
      { title: 'Dynamique d\'équipe',              hint: 'Cohésion, ambiance et synergies' },
      { title: 'Gestion des conflits',             hint: 'Résolution des tensions internes' },
      { title: 'Motivation / cohésion',            hint: 'Engagement et moral de l\'équipe' },
      { title: 'Communication intra-staff',        hint: 'Coordination avec l\'équipe technique' },
    ],
  },
  {
    id: 'match',
    label: 'Performance en match',
    color: '#ef4444',
    questions: [
      { title: 'Réactivité in-game',               hint: 'Ajustements tactiques durant les parties' },
      { title: 'Qualité des appels',               hint: 'Précision et timing des directives' },
      { title: 'Gestion du stress / tilt',         hint: 'Stabilité psychologique sous pression' },
      { title: 'Bilan post-match',                 hint: 'Debriefs et transmission des enseignements' },
    ],
  },
]

const QLABELS = ['—', 'Insuffisant', 'À développer', 'Correct', 'Bon niveau', 'Excellence']
const objPlaceholders = [
  'Ex: Améliorer la structure des sessions VOD…',
  'Ex: Mettre en place un suivi individuel hebdomadaire…',
  'Ex: Optimiser la préparation draft adversaire…',
]

const loading   = ref(true)
const exporting = ref(false)
const scores    = reactive({})
const analysis  = reactive({ strengths: '', improvements: '', obs: '' })
const objectives = ref(['', '', ''])
const finalNote  = ref(null)
const noteComment = ref('')
const form = reactive({ eval: '', period: '' })

const syncState = ref('offline')
const syncText  = ref('')
const syncTime  = ref('')
const syncFlash = ref(false)
let saveTimer = null
let unsub = null
const exportRef = ref(null)

function catScore(id) {
  const cat = cats.find(c => c.id === id)
  if (!cat) return 0
  const total = cat.questions.reduce((s, _, i) => s + (scores[id]?.[i] ?? 0), 0)
  return Math.round((total / (cat.questions.length * 5)) * 20 * 10) / 10
}

const globalScore = computed(() => {
  const total = cats.reduce((s, c) => s + catScore(c.id), 0)
  return Math.round((total / cats.length) * 10) / 10
})

const scoreColor = computed(() => {
  const s = globalScore.value
  if (s >= 16) return '#22c55e'
  if (s >= 10) return '#f59e0b'
  return '#ef4444'
})

const scoreLabel = computed(() => {
  const s = globalScore.value
  if (s === 0)  return '—'
  if (s < 7)    return 'Insuffisant'
  if (s < 10)   return 'À développer'
  if (s < 13)   return 'Correct'
  if (s < 16)   return 'Bon niveau'
  if (s < 18)   return 'Très bon'
  return 'Excellence'
})

function setScore(catId, qi, val) {
  if (!scores[catId]) scores[catId] = {}
  scores[catId][qi] = (scores[catId][qi] ?? 0) === val ? 0 : val
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
      scores: JSON.parse(JSON.stringify(scores)),
      analysis: { ...analysis },
      objectives: objectives.value,
      finalNote: finalNote.value,
      noteComment: noteComment.value,
      form: { ...form },
      updatedAt: new Date().toISOString(),
    })
    syncState.value = 'ok'
    syncText.value = 'Sauvegardé'
    syncTime.value = new Date().toLocaleTimeString('fr-FR')
    syncFlash.value = true
    setTimeout(() => (syncFlash.value = false), 1000)
  } catch {
    syncState.value = 'error'
    syncText.value = 'Erreur de sauvegarde'
  }
}

function doBackup() {
  const data = { scores: JSON.parse(JSON.stringify(scores)), analysis: { ...analysis }, objectives: objectives.value, finalNote: finalNote.value, noteComment: noteComment.value, form: { ...form } }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
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
    const d = JSON.parse(await file.text())
    Object.assign(scores, d.scores ?? {})
    Object.assign(analysis, d.analysis ?? { strengths: '', improvements: '', obs: '' })
    objectives.value = d.objectives ?? ['', '', '']
    finalNote.value = d.finalNote ?? null
    noteComment.value = d.noteComment ?? ''
    Object.assign(form, d.form ?? { eval: '', period: '' })
    await forceSave()
  }
  input.click()
}

async function doReset() {
  if (!confirm('Réinitialiser toutes les données coach ?')) return
  Object.keys(scores).forEach(k => delete scores[k])
  Object.assign(analysis, { strengths: '', improvements: '', obs: '' })
  objectives.value = ['', '', '']
  finalNote.value = null
  noteComment.value = ''
  Object.assign(form, { eval: '', period: '' })
  await forceSave()
}

async function exportPng() {
  if (!exportRef.value) return
  exporting.value = true
  const canvas = await html2canvas(exportRef.value, { backgroundColor: '#020c10', scale: 2 })
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `coach-${Date.now()}.png`
  a.click()
  exporting.value = false
}

onMounted(() => {
  unsub = onSnapshot(doc(db, 'plazma', DOC_ID), snap => {
    if (snap.exists()) {
      const d = snap.data()
      Object.assign(scores, d.scores ?? {})
      Object.assign(analysis, d.analysis ?? { strengths: '', improvements: '', obs: '' })
      objectives.value = d.objectives ?? ['', '', '']
      finalNote.value = d.finalNote ?? null
      noteComment.value = d.noteComment ?? ''
      Object.assign(form, d.form ?? { eval: '', period: '' })
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
