<template>
  <div class="page-wrap">
    <LoadingScreen :visible="loading" color="var(--c1)" />

    <div class="toolbar">
      <button class="btn btn-export" :disabled="exporting" @click="exportPng">
        {{ exporting ? 'Export…' : '⬇ Exporter PNG' }}
      </button>
    </div>

    <SyncStatus
      :state="syncState"
      :text="syncText"
      :time="syncTime"
      :flash-ok="flashOk"
      @save="save"
      @backup="exportBackup"
      @import="importBackup"
      @reset="resetData"
    />

    <div class="card" id="teamCard">

      <!-- HEADER -->
      <div class="card-header">
        <div class="header-left">
          <div class="logo-mark">PZ</div>
          <div>
            <div class="club-name">PlaZma Esport · RoZter</div>
            <div class="doc-type">Évaluation Équipe</div>
          </div>
        </div>
        <div class="header-right">
          <Users :size="32" style="color:var(--c1)" />
          <div>
            <div class="header-sub">Performance Collective</div>
            <div class="season-tag">Saison 2026</div>
          </div>
        </div>
      </div>

      <!-- SCORE GLOBAL -->
      <div class="score-band">
        <div class="score-left">
          <div style="display:flex;align-items:baseline;gap:6px">
            <div class="score-num" :style="{ color: scoreColor }">{{ globalScore > 0 ? globalScore.toFixed(1) : '—' }}</div>
            <div class="score-denom">/ 10</div>
          </div>
          <div class="score-lbl">Score global équipe</div>
        </div>
        <div class="score-right">
          <div class="score-qual" :style="{ color: scoreColor }">{{ scoreLabel }}</div>
          <div class="score-track">
            <div class="score-fill" :style="{ width: (globalScore / 10 * 100) + '%', background: 'var(--c1)' }"></div>
          </div>
          <div class="cat-pills">
            <div v-for="cp in catPills" :key="cp.label" class="cp" :style="{ background: cp.color + '14', color: cp.color, border: `1px solid ${cp.color}28` }">
              {{ cp.label }}
            </div>
          </div>
        </div>
      </div>

      <div class="card-body">

        <!-- JAUGES -->
        <div>
          <div class="sec-head"><div class="sec-dot" style="background:var(--c1)"></div>Évaluation des compétences collectives (0 – 10)</div>
          <div v-for="cat in CATEGORIES" :key="cat.label" class="cat-block">
            <div class="cat-label" :style="{ color: cat.color }">{{ cat.label }}</div>
            <div class="jauge-list">
              <div v-for="item in cat.items" :key="item.id" class="jr" :style="{ '--jc': cat.color + '60' }">
                <div class="jr-label">
                  <strong>{{ item.l }}</strong>
                  <small v-if="item.h">{{ item.h }}</small>
                </div>
                <div class="jr-dots">
                  <div
                    v-for="n in 10" :key="n"
                    class="jd" :class="{ on: (jauges[item.id] || 0) >= n }"
                    :style="{ background: cat.color }"
                    @click="toggleJauge(item.id, n)"
                  ></div>
                </div>
                <div class="jr-num" :style="{ color: jauges[item.id] ? cat.color : 'var(--tx3)' }">
                  {{ jauges[item.id] || 0 }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- COMPOSITION MASTERY -->
        <div>
          <div class="sec-head"><div class="sec-dot" style="background:var(--purple)"></div>Maîtrise des compositions</div>
          <div class="comp-mastery-grid">
            <div v-for="(comp, i) in form.compositions" :key="i" class="comp-mastery-card">
              <div class="comp-m-num">0{{ i + 1 }}</div>
              <div class="field">
                <label>Nom de la composition</label>
                <input v-model="comp.name" type="text" placeholder="ex: Engage, Poke, Protect…" @input="debounceSave" />
              </div>
              <div class="mastery-wrap">
                <div class="mastery-label">Niveau de maîtrise</div>
                <div class="stars">
                  <span
                    v-for="s in 5" :key="s"
                    class="star"
                    :class="{ on: comp.mastery >= s }"
                    @click="comp.mastery = comp.mastery === s ? 0 : s; debounceSave()"
                  >★</span>
                </div>
                <div class="mastery-text">{{ masteryLabel(comp.mastery) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- MONTHLY BALANCE -->
        <div>
          <div class="sec-head"><div class="sec-dot" style="background:var(--yellow)"></div>Bilan mensuel</div>
          <div class="obs-grid">
            <div class="obs-card" style="border-left:2px solid var(--c1)">
              <div class="obs-lbl" style="color:var(--c1)">✦ Ce mois-ci</div>
              <textarea class="obs-ta" v-model="form.thisMonth" placeholder="Résultats, performances, tournois de ce mois…" @input="debounceSave"></textarea>
            </div>
            <div class="obs-card" style="border-left:2px solid var(--tx3)">
              <div class="obs-lbl" style="color:var(--tx3)">✦ Le mois dernier</div>
              <textarea class="obs-ta" v-model="form.lastMonth" placeholder="Comparaison avec le mois précédent…" @input="debounceSave"></textarea>
            </div>
          </div>
        </div>

        <!-- ANALYSE QUALITATIVE -->
        <div>
          <div class="sec-head"><div class="sec-dot" style="background:var(--c1)"></div>Analyse qualitative</div>
          <div class="obs-grid" style="margin-bottom:9px">
            <div class="obs-card" style="border-left:2px solid var(--green)">
              <div class="obs-lbl" style="color:var(--green)">✦ Forces de l'équipe</div>
              <textarea class="obs-ta" v-model="form.forces" placeholder="Points forts collectifs, domaines excellents…" @input="debounceSave"></textarea>
            </div>
            <div class="obs-card" style="border-left:2px solid var(--red)">
              <div class="obs-lbl" style="color:var(--red)">✦ Faiblesses à corriger</div>
              <textarea class="obs-ta" v-model="form.faib" placeholder="Lacunes, erreurs récurrentes, axes de progression…" @input="debounceSave"></textarea>
            </div>
          </div>
          <div class="obs-full" style="border-left:2px solid var(--c1)">
            <div class="obs-lbl" style="color:var(--c1)">✦ Observations générales</div>
            <textarea class="obs-ta" v-model="form.obs" placeholder="Synergies, dynamique d'équipe, comportement en match…" @input="debounceSave"></textarea>
          </div>
        </div>

        <!-- OBJECTIFS -->
        <div>
          <div class="sec-head"><div class="sec-dot" style="background:var(--green)"></div>Objectifs collectifs pour la prochaine période</div>
          <div class="obj-list-perf">
            <div v-for="(_, i) in 3" :key="i" class="obj-row">
              <div class="obj-n">0{{ i + 1 }}</div>
              <input class="obj-inp" v-model="form.objectives[i]" type="text" :placeholder="objPlaceholders[i]" @input="debounceSave" />
            </div>
          </div>
        </div>

      </div>

      <!-- FOOTER -->
      <div class="card-footer">
        <div class="footer-brand">PlaZma Esport · RoZter · plazma-esport.fr</div>
        <div class="footer-sigs">
          <div class="sig"><div class="sig-line"></div><div class="sig-label">Coach</div></div>
          <div class="sig"><div class="sig-line"></div><div class="sig-label">Capitaine</div></div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { Users } from 'lucide-vue-next'
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import SyncStatus from '../components/SyncStatus.vue'
import LoadingScreen from '../components/LoadingScreen.vue'
import html2canvas from 'html2canvas'

const loading   = ref(true)
const exporting = ref(false)

const syncState = ref('offline')
const syncText  = ref('En attente…')
const syncTime  = ref('')
const flashOk   = ref(null)

const jauges = reactive({})
const form   = reactive({
  forces: '', faib: '', obs: '',
  thisMonth: '', lastMonth: '',
  objectives: ['', '', ''],
  compositions: [
    { name: '', mastery: 0 },
    { name: '', mastery: 0 },
    { name: '', mastery: 0 },
  ],
})

let debTimer    = null
let unsubscribe = null

const CATEGORIES = [
  {
    label: 'Early Game', color: '#f59e0b',
    items: [
      { id: 'invasion',     l: 'Invasion / Counter-jungle', h: '' },
      { id: 'visionEarly',  l: 'Vision Early Game',         h: '' },
      { id: 'laningPhase',  l: 'Laning Phase Collective',   h: '' },
    ],
  },
  {
    label: 'Vision & Contrôle', color: '#22c55e',
    items: [
      { id: 'mapCoverage',  l: 'Coverage carte',             h: '' },
      { id: 'setupVision',  l: 'Setup avant objectifs',      h: '' },
      { id: 'deniVision',   l: 'Déni de vision adverse',     h: '' },
    ],
  },
  {
    label: 'Macro & Rotation', color: '#3b82f6',
    items: [
      { id: 'rotationTiming', l: 'Timing des rotations',       h: '' },
      { id: 'objectifMgmt',   l: 'Gestion des objectifs',      h: 'Dragon, Baron, Herald…' },
      { id: 'splitVs5v5',     l: 'Split vs 5v5',               h: '' },
    ],
  },
  {
    label: 'Teamfight', color: '#ef4444',
    items: [
      { id: 'engageDisengage', l: 'Engage / Disengage',        h: '' },
      { id: 'protectCarries',  l: 'Protection des carries',    h: '' },
      { id: 'cleanup',         l: 'Cleanup & suivi du combat', h: '' },
    ],
  },
  {
    label: 'Communication', color: '#a855f7',
    items: [
      { id: 'shotCalling', l: 'Shot calling',              h: '' },
      { id: 'reactivite',  l: 'Réactivité aux infos',      h: '' },
      { id: 'calmePression', l: 'Calme sous pression',     h: '' },
    ],
  },
  {
    label: 'Mental & Draft', color: '#f97316',
    items: [
      { id: 'flexDraft',      l: 'Flexibilité draft',         h: '' },
      { id: 'resilience',     l: 'Résilience en déficit',     h: '' },
      { id: 'consistance',    l: 'Consistance des résultats', h: '' },
    ],
  },
]

const QLABELS = ['—','Très faible','Faible','Insuffisant','Passable','Correct','Satisfaisant','Bon','Très bon','Excellent','Élite']

const objPlaceholders = [
  'Ex : Améliorer le win-rate sur Dragon Soul de 40% à 65%',
  'Ex : Réduire les défaites après avoir pris le premier baron',
  'Ex : Maîtriser 2 nouvelles compositions d\'ici la fin du mois',
]

const globalScore = computed(() => {
  const allVals = []
  CATEGORIES.forEach(cat => {
    const vals = cat.items.map(i => jauges[i.id] || 0).filter(v => v > 0)
    if (vals.length) allVals.push(vals.reduce((a, b) => a + b) / vals.length)
  })
  return allVals.length ? allVals.reduce((a, b) => a + b) / allVals.length : 0
})

const scoreColor = computed(() => {
  const g = globalScore.value
  if (g >= 8) return 'var(--green)'
  if (g >= 6) return 'var(--c1)'
  if (g >= 4) return 'var(--yellow)'
  if (g > 0)  return 'var(--red)'
  return 'var(--c1)'
})

const scoreLabel = computed(() => QLABELS[Math.round(globalScore.value)] || '—')

const catPills = computed(() => CATEGORIES.map(cat => {
  const vals = cat.items.map(i => jauges[i.id] || 0).filter(v => v > 0)
  if (!vals.length) return null
  const avg = vals.reduce((a, b) => a + b) / vals.length
  return { label: cat.label.split(' ')[0] + ' ' + avg.toFixed(1), color: cat.color }
}).filter(Boolean))

function masteryLabel(n) {
  return ['Non travaillée', 'Découverte', 'En apprentissage', 'Correcte', 'Maîtrisée', 'Excellente'][n] || '—'
}

function toggleJauge(id, n) {
  jauges[id] = jauges[id] === n ? 0 : n
  debounceSave()
}

function getState() {
  return { ...JSON.parse(JSON.stringify(form)), jauges: { ...jauges } }
}

function applyState(s) {
  if (!s) return
  if (s.forces    !== undefined) form.forces    = s.forces
  if (s.faib      !== undefined) form.faib      = s.faib
  if (s.obs       !== undefined) form.obs       = s.obs
  if (s.thisMonth !== undefined) form.thisMonth = s.thisMonth
  if (s.lastMonth !== undefined) form.lastMonth = s.lastMonth
  if (s.objectives) form.objectives = s.objectives
  if (s.compositions) {
    s.compositions.forEach((c, i) => {
      if (form.compositions[i]) Object.assign(form.compositions[i], c)
    })
  }
  if (s.jauges) Object.assign(jauges, s.jauges)
}

function setSyncState(state, text, time = '') {
  syncState.value = state; syncText.value = text; syncTime.value = time
}

function flash(ok) {
  flashOk.value = ok
  setTimeout(() => { flashOk.value = null }, 1600)
}

async function save() {
  setSyncState('syncing', 'Sauvegarde…')
  try {
    await setDoc(doc(db, 'plazma', 'team'), getState())
    setSyncState('connected', 'Synchronisé', new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    flash(true)
  } catch (e) {
    setSyncState('error', 'Erreur Firebase')
    flash(false)
    console.error(e)
  }
}

function debounceSave() {
  clearTimeout(debTimer)
  debTimer = setTimeout(save, 1000)
}

function exportBackup() {
  const b = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b)
  a.download = `plazma-team-${new Date().toISOString().split('T')[0]}.json`
  a.click()
}

function importBackup() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json'
  inp.addEventListener('change', async () => {
    try { applyState(JSON.parse(await inp.files[0].text())); save() }
    catch { alert('Fichier invalide') }
  })
  inp.click()
}

async function resetData() {
  if (!confirm('Réinitialiser l\'évaluation d\'équipe ?')) return
  Object.keys(jauges).forEach(k => { jauges[k] = 0 })
  Object.assign(form, {
    forces: '', faib: '', obs: '', thisMonth: '', lastMonth: '',
    objectives: ['', '', ''],
    compositions: [{ name:'',mastery:0 },{ name:'',mastery:0 },{ name:'',mastery:0 }],
  })
  await deleteDoc(doc(db, 'plazma', 'team'))
  setSyncState('connected', 'Réinitialisé', '')
}

async function exportPng() {
  exporting.value = true
  const el = document.getElementById('teamCard')
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link').forEach(e => { e.style.visibility = 'hidden' })
  await new Promise(r => setTimeout(r, 80))
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#04111a', useCORS: true, logging: false })
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link').forEach(e => { e.style.visibility = '' })
  exporting.value = false
  const a = document.createElement('a')
  a.download = `plazma-team-${new Date().toISOString().split('T')[0]}.png`
  a.href = canvas.toDataURL('image/png'); a.click()
}

onMounted(() => {
  setSyncState('syncing', 'Connexion…')
  unsubscribe = onSnapshot(doc(db, 'plazma', 'team'), snapshot => {
    if (snapshot.metadata.hasPendingWrites) return
    if (snapshot.exists()) applyState(snapshot.data())
    setSyncState('connected', 'Synchronisé', new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    loading.value = false
  }, err => {
    console.error(err)
    setSyncState('error', 'Erreur connexion')
    loading.value = false
  })
  setTimeout(() => { if (loading.value) { loading.value = false; setSyncState('error', 'Firebase inaccessible') } }, 8000)
})

onUnmounted(() => { if (unsubscribe) unsubscribe(); clearTimeout(debTimer) })
</script>

<style scoped>
.card { max-width: 920px; }
.header-right { display: flex; align-items: center; gap: 12px; }
.header-icon  { font-size: 32px; }
.header-sub   { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); }

.comp-mastery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.comp-mastery-card { background: var(--sf); border: 1px solid var(--bd); padding: 16px; clip-path: polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%); }
.comp-m-num { font-family: 'Rajdhani', sans-serif; font-size: 32px; font-weight: 700; color: var(--bd2); margin-bottom: 10px; }

.mastery-wrap { margin-top: 6px; }
.mastery-label { font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); margin-bottom: 8px; }
.stars { display: flex; gap: 4px; margin-bottom: 5px; }
.star { font-size: 24px; cursor: pointer; color: var(--bd2); transition: color .15s, transform .1s; }
.star.on { color: var(--yellow); }
.star:hover { color: var(--yellow); transform: scale(1.2); }
.mastery-text { font-size: 10px; color: var(--tx3); font-style: italic; }

@media(max-width:780px) {
  .comp-mastery-grid { grid-template-columns: 1fr; }
  .obs-grid { grid-template-columns: 1fr; }
}
</style>
