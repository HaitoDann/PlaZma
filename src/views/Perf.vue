<template>
  <div class="page-wrap">
    <LoadingScreen :visible="loading" :color="player?.color || 'var(--c1)'" />

    <RouterLink to="/" class="hub-link">← Hub RoZter</RouterLink>

    <div class="toolbar">
      <button class="btn btn-export" :style="{ background: player?.color }" :disabled="exporting" @click="exportPng">
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

    <div v-if="player" class="card" id="perfCard" :style="{ '--rc': player.color, '--rc2': player.colorRgb }">

      <!-- HEADER -->
      <div class="card-header" :style="{ '--role-color': player.color }">
        <div class="header-left">
          <div class="logo-mark" :style="{ background: `rgba(${player.colorRgb},.12)`, border: `1px solid rgba(${player.colorRgb},.25)`, color: player.color }">PZ</div>
          <div>
            <div class="club-name">PlaZma Esport · RoZter</div>
            <div class="doc-type">Fiche Performance {{ player.role }}</div>
          </div>
        </div>
        <div class="player-display">
          <div class="player-emo">{{ player.roleEmoji }}</div>
          <div class="player-info">
            <div class="player-pseudo" :style="{ color: player.color }">{{ player.name }}</div>
            <div class="player-role">{{ player.role }} Lane · League of Legends</div>
            <div class="season-tag" :style="{ color: `rgba(${player.colorRgb},.5)`, border: `1px solid rgba(${player.colorRgb},.15)`, background: `rgba(${player.colorRgb},.05)` }">Saison 2026</div>
          </div>
        </div>
      </div>

      <!-- META -->
      <div class="meta-bar">
        <div class="meta-lbl">Évaluateur</div>
        <input class="meta-inp" v-model="form.eval" type="text" placeholder="Coach / Manager" @input="debounceSave" :style="{ '--focus-color': player.color }">
      </div>

      <!-- SCORE GLOBAL -->
      <div class="score-band">
        <div class="score-left">
          <div style="display:flex;align-items:baseline;gap:6px">
            <div class="score-num" :style="{ color: scoreColor }">{{ globalScore > 0 ? globalScore.toFixed(1) : '—' }}</div>
            <div class="score-denom">/ 10</div>
          </div>
          <div class="score-lbl">Score global</div>
        </div>
        <div class="score-right">
          <div class="score-qual" :style="{ color: scoreColor }">{{ scoreLabel }}</div>
          <div class="score-track">
            <div class="score-fill" :style="{ width: (globalScore / 10 * 100) + '%', background: player.color }"></div>
          </div>
          <div class="cat-pills">
            <div v-for="cp in catPills" :key="cp.label" class="cp" :style="{ background: cp.color + '14', color: cp.color, border: `1px solid ${cp.color}28` }">
              {{ cp.label }}
            </div>
          </div>
        </div>
      </div>

      <!-- BODY -->
      <div class="card-body">

        <!-- JAUGES -->
        <div>
          <div class="sec-head">
            <div class="sec-dot" :style="{ background: player.color }"></div>
            Évaluation des compétences (0 – 10)
          </div>
          <div v-for="cat in player.cats" :key="cat.label" class="cat-block">
            <div class="cat-label" :style="{ color: cat.color }">{{ cat.label }}</div>
            <div class="jauge-list">
              <div v-for="item in cat.items" :key="item.id" class="jr" :style="{ '--jc': cat.color + '60' }">
                <div class="jr-label">
                  <strong>{{ item.l }}</strong>
                  <small>{{ item.h }}</small>
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

        <!-- ANALYSE QUALITATIVE -->
        <div>
          <div class="sec-head"><div class="sec-dot" :style="{ background: player.color }"></div>Analyse qualitative</div>
          <div class="obs-grid" style="margin-bottom:9px">
            <div class="obs-card" style="border-left:2px solid var(--green)">
              <div class="obs-lbl" style="color:var(--green)">✦ Forces identifiées</div>
              <textarea class="obs-ta" v-model="form.forces" placeholder="Forces identifiées avec exemples concrets…" @input="debounceSave"></textarea>
            </div>
            <div class="obs-card" style="border-left:2px solid var(--red)">
              <div class="obs-lbl" style="color:var(--red)">✦ Points à améliorer</div>
              <textarea class="obs-ta" v-model="form.faib" placeholder="Points à travailler, erreurs récurrentes…" @input="debounceSave"></textarea>
            </div>
          </div>
          <div class="obs-full" :style="{ borderLeft: `2px solid var(--c1)` }">
            <div class="obs-lbl" style="color:var(--c1)">✦ Observations générales</div>
            <textarea class="obs-ta" v-model="form.obs" placeholder="Comportement in-game, communication, régularité, attitude…" @input="debounceSave"></textarea>
          </div>
        </div>

        <!-- OBJECTIFS -->
        <div>
          <div class="sec-head"><div class="sec-dot" style="background:var(--green)"></div>Objectifs pour la prochaine période</div>
          <div class="obj-list-perf">
            <div v-for="(_, i) in 3" :key="i" class="obj-row">
              <div class="obj-n">0{{ i + 1 }}</div>
              <input class="obj-inp" v-model="form.objectives[i]" type="text" :placeholder="objPlaceholders[i]" @input="debounceSave" :style="{ '--focus-color': player.color }">
            </div>
          </div>
        </div>

        <!-- NOTE GLOBALE -->
        <div class="note-block">
          <div class="nb-wrap">
            <input class="nb-inp" v-model="form.note" type="number" min="0" max="20" placeholder="—" @input="debounceSave" :style="{ color: player.color, borderBottomColor: `rgba(${player.colorRgb},.25)`, textShadow: `0 0 20px rgba(${player.colorRgb},.4)` }">
            <div class="nb-over">/ 20</div>
          </div>
          <div class="nb-right">
            <div class="nb-lbl" :style="{ color: player.color }">Note finale du coach</div>
            <input class="nb-comment" v-model="form.comment" type="text" placeholder="Commentaire libre du coach…" @input="debounceSave">
            <div class="nb-scale">0–8 · À améliorer &nbsp;|&nbsp; 9–12 · Correct &nbsp;|&nbsp; 13–16 · Bon &nbsp;|&nbsp; 17–20 · Excellent</div>
          </div>
        </div>

      </div>

      <!-- FOOTER -->
      <div class="card-footer">
        <div class="footer-brand">PlaZma Esport · RoZter · plazma-esport.fr</div>
        <div class="footer-sigs">
          <div class="sig"><div class="sig-line"></div><div class="sig-label">Coach</div></div>
          <div class="sig"><div class="sig-line"></div><div class="sig-label">Joueur</div></div>
        </div>
      </div>

    </div>

    <div v-else class="not-found">Joueur introuvable pour le rôle "{{ route.params.role }}"</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { getPlayerByRole, QLABELS } from '../data/players.js'
import SyncStatus from '../components/SyncStatus.vue'
import LoadingScreen from '../components/LoadingScreen.vue'
import html2canvas from 'html2canvas'

const route    = useRoute()
const player   = computed(() => getPlayerByRole(route.params.role))
const loading  = ref(true)
const exporting = ref(false)

const syncState = ref('offline')
const syncText  = ref('En attente…')
const syncTime  = ref('')
const flashOk   = ref(null)

const jauges = reactive({})
const form   = reactive({ eval: '', forces: '', faib: '', obs: '', objectives: ['','',''], note: '', comment: '' })

let debTimer   = null
let unsubscribe = null

const objPlaceholders = [
  'Ex : Maintenir 7.5+ CS/min et limiter les morts inutiles en lane',
  'Ex : Utiliser le TP offensif de manière décisive dans 60% des games',
  'Ex : Maîtriser 1 pick supplémentaire pour la flexibilité en draft',
]

// Score computed
const globalScore = computed(() => {
  if (!player.value) return 0
  const allVals = []
  player.value.cats.forEach(cat => {
    const vals = cat.items.map(i => jauges[i.id] || 0).filter(v => v > 0)
    if (vals.length) allVals.push(vals.reduce((a, b) => a + b) / vals.length)
  })
  return allVals.length ? allVals.reduce((a, b) => a + b) / allVals.length : 0
})

const scoreColor = computed(() => {
  const g = globalScore.value
  if (g >= 8) return 'var(--green)'
  if (g >= 6) return player.value?.color || 'var(--c1)'
  if (g >= 4) return 'var(--yellow)'
  if (g > 0)  return 'var(--red)'
  return player.value?.color || 'var(--c1)'
})

const scoreLabel = computed(() => QLABELS[Math.round(globalScore.value)] || '—')

const catPills = computed(() => {
  if (!player.value) return []
  return player.value.cats.map(cat => {
    const vals = cat.items.map(i => jauges[i.id] || 0).filter(v => v > 0)
    if (!vals.length) return null
    const avg = vals.reduce((a, b) => a + b) / vals.length
    return { label: cat.label.split(' ')[0] + ' ' + avg.toFixed(1), color: cat.color }
  }).filter(Boolean)
})

function toggleJauge(id, n) {
  jauges[id] = jauges[id] === n ? 0 : n
  debounceSave()
}

function getState() {
  return { ...form, jauges: { ...jauges } }
}

function applyState(s) {
  if (!s) return
  Object.assign(form, {
    eval: s.eval || '', forces: s.forces || '', faib: s.faib || '',
    obs: s.obs || '', objectives: s.objectives || ['','',''],
    note: s.note || '', comment: s.comment || '',
  })
  if (s.jauges) Object.assign(jauges, s.jauges)
}

function setSyncState(state, text, time = '') {
  syncState.value = state; syncText.value = text; syncTime.value = time
}

function hideLoading() { loading.value = false }

async function save() {
  if (!player.value) return
  setSyncState('syncing', 'Sauvegarde…')
  try {
    await setDoc(doc(db, 'plazma', player.value.docId), getState())
    setSyncState('connected', 'Synchronisé')
    flash(true)
  } catch (e) {
    setSyncState('error', 'Erreur Firebase')
    flash(false)
    console.error(e)
  }
}

function flash(ok) {
  flashOk.value = ok
  setTimeout(() => { flashOk.value = null }, 1600)
}

function debounceSave() {
  clearTimeout(debTimer)
  debTimer = setTimeout(save, 1000)
}

function exportBackup() {
  if (!player.value) return
  const b = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b)
  a.download = `plazma-perf-${player.value.id}-${new Date().toISOString().split('T')[0]}.json`
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
  if (!player.value || !confirm(`Réinitialiser la fiche de ${player.value.name} ?`)) return
  Object.keys(jauges).forEach(k => { jauges[k] = 0 })
  Object.assign(form, { eval: '', forces: '', faib: '', obs: '', objectives: ['','',''], note: '', comment: '' })
  await deleteDoc(doc(db, 'plazma', player.value.docId))
  setSyncState('connected', 'Réinitialisé', '')
}

async function exportPng() {
  exporting.value = true
  const el = document.getElementById('perfCard')
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link').forEach(e => { e.style.visibility = 'hidden' })
  await new Promise(r => setTimeout(r, 80))
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#04111a', useCORS: true, logging: false })
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link').forEach(e => { e.style.visibility = '' })
  exporting.value = false
  const a = document.createElement('a')
  a.download = `plazma-perf-${player.value?.id || 'player'}.png`
  a.href = canvas.toDataURL('image/png'); a.click()
}

function startSync() {
  if (unsubscribe) unsubscribe()
  if (!player.value) { loading.value = false; return }
  setSyncState('syncing', 'Connexion…')
  unsubscribe = onSnapshot(doc(db, 'plazma', player.value.docId), snapshot => {
    if (snapshot.metadata.hasPendingWrites) return
    if (snapshot.exists()) applyState(snapshot.data())
    setSyncState('connected', 'Synchronisé', new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    hideLoading()
  }, err => {
    console.error(err)
    setSyncState('error', 'Erreur connexion')
    hideLoading()
  })
  setTimeout(() => { if (loading.value) { hideLoading(); setSyncState('error', 'Firebase inaccessible') } }, 8000)
}

watch(() => route.params.role, () => {
  if (player.value) {
    player.value.cats.forEach(cat => cat.items.forEach(i => { jauges[i.id] = 0 }))
    Object.assign(form, { eval: '', forces: '', faib: '', obs: '', objectives: ['','',''], note: '', comment: '' })
    loading.value = true
    startSync()
  }
})

onMounted(startSync)
onUnmounted(() => { if (unsubscribe) unsubscribe(); clearTimeout(debTimer) })
</script>

<style scoped>
.page-wrap { display: flex; flex-direction: column; align-items: center; padding: 28px 20px 80px; }
.not-found { color: var(--tx3); margin-top: 80px; font-size: 14px; }
.player-display { display: flex; align-items: center; gap: 12px; }
.player-emo { font-size: 32px; }
.player-info { text-align: right; }
.player-pseudo { font-family: 'Rajdhani', sans-serif; font-size: 38px; font-weight: 700; letter-spacing: 3px; line-height: 1; }
.player-role { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: var(--tx3); margin-top: 3px; }
.card { max-width: 920px; }
.card-header::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 50% 180% at 0% 50%, rgba(var(--rc2, 6,182,212),.06), transparent 65%); }
.meta-inp:focus { border-bottom-color: var(--rc, var(--c1)); }
.obj-inp:focus { border-bottom-color: var(--rc, var(--c1)); }
@media(max-width:780px){
  .card-body { padding: 14px 16px; }
  .obs-grid { grid-template-columns: 1fr; }
  .card-header { flex-direction: column; align-items: flex-start; }
  .player-info { text-align: left; }
  .jr-label { min-width: 160px; }
  .score-band { flex-direction: column; align-items: flex-start; gap: 14px; }
}
</style>
