<template>
  <div class="page-wrap">
    <LoadingScreen :visible="loading" label="Scrim" color="var(--c1)" />

    <div class="toolbar">
      <button class="btn btn-export" :disabled="exporting" @click="exportPng">
        {{ exporting ? 'Export…' : '⬇ Exporter PNG' }}
      </button>
      <button class="btn btn-new" @click="openNewSession">+ Nouvelle session</button>
      <button class="btn btn-drawer" @click="drawerOpen = !drawerOpen">
        {{ drawerOpen ? '✕ Fermer' : '📋 Historique' }}
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

    <!-- HISTORY DRAWER -->
    <div class="drawer" :class="{ open: drawerOpen }">
      <div class="drawer-head">
        <div class="drawer-title">Historique des scrims</div>
        <div class="drawer-count">{{ sessions.length }} session{{ sessions.length !== 1 ? 's' : '' }}</div>
      </div>
      <div class="drawer-list">
        <div
          v-if="sessions.length === 0"
          class="drawer-empty"
        >Aucune session enregistrée</div>
        <div
          v-for="(s, i) in sessions"
          :key="i"
          class="drawer-item"
          :class="{ active: activeIdx === i }"
          @click="loadSession(i)"
        >
          <div class="di-left">
            <div class="di-date">{{ s.date || '—' }}</div>
            <div class="di-opponent">vs {{ s.opponent || 'Inconnu' }}</div>
          </div>
          <div class="di-right">
            <div class="di-result" :class="s.result?.toLowerCase()">{{ s.result || '?' }}</div>
            <div class="di-score">{{ s.score || '' }}</div>
            <button class="di-del" @click.stop="deleteSession(i)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN CARD -->
    <div class="card" id="scrimCard">
      <!-- HEADER -->
      <div class="card-header">
        <div class="header-left">
          <div class="logo-mark">PZ</div>
          <div>
            <div class="club-name">PlaZma Esport · RoZter</div>
            <div class="doc-type">Rapport de Scrim</div>
          </div>
        </div>
        <div class="header-right">
          <div class="week-label-sm">Session active</div>
          <div class="session-label">{{ form.date || 'Nouvelle session' }}</div>
          <div class="season-tag">Saison 2026</div>
        </div>
      </div>

      <!-- SESSION INFO -->
      <div class="section-band">
        <div class="sb-icon">⚔️</div>
        <div class="sb-title">Informations de session</div>
      </div>
      <div class="card-body">
        <div class="form-row">
          <div class="field">
            <label>Date</label>
            <input type="date" v-model="form.date" @input="debounceSave" />
          </div>
          <div class="field">
            <label>Adversaire</label>
            <input type="text" v-model="form.opponent" placeholder="Nom de l'équipe adverse" @input="debounceSave" />
          </div>
          <div class="field field-sm">
            <label>Résultat</label>
            <select v-model="form.result" @change="debounceSave">
              <option value="">—</option>
              <option value="W">Victoire (W)</option>
              <option value="L">Défaite (L)</option>
              <option value="D">Nul (D)</option>
            </select>
          </div>
          <div class="field field-sm">
            <label>Score</label>
            <input type="text" v-model="form.score" placeholder="ex: 3-2" @input="debounceSave" />
          </div>
        </div>

        <!-- GAMES -->
        <div class="sec-head">
          <div class="sec-dot"></div>
          Games (1 – 5)
        </div>
        <div class="games-list">
          <div v-for="(g, gi) in form.games" :key="gi" class="game-row">
            <div class="game-num">G{{ gi + 1 }}</div>
            <div class="game-fields">
              <div class="field field-xs">
                <label>Résultat</label>
                <select v-model="g.result" @change="debounceSave">
                  <option value="">—</option>
                  <option value="W">W</option>
                  <option value="L">L</option>
                </select>
              </div>
              <div class="field field-xs">
                <label>Durée</label>
                <input type="text" v-model="g.duration" placeholder="25:30" @input="debounceSave" />
              </div>
              <div class="field field-xs">
                <label>Side</label>
                <select v-model="g.side" @change="debounceSave">
                  <option value="">—</option>
                  <option value="Blue">Blue</option>
                  <option value="Red">Red</option>
                </select>
              </div>
              <div class="field field-xs">
                <label>K/D ratio</label>
                <input type="text" v-model="g.kd" placeholder="12/8" @input="debounceSave" />
              </div>
            </div>
            <div class="game-badge" :class="g.result?.toLowerCase()">{{ g.result || '?' }}</div>
          </div>
        </div>

        <!-- PLAYER FEEDBACK -->
        <div class="sec-head">
          <div class="sec-dot" style="background:var(--purple)"></div>
          Feedback par joueur
        </div>
        <div class="players-grid">
          <div v-for="p in PLAYERS_LIST" :key="p.id" class="player-feedback-card" :style="{ '--pc': p.color }">
            <div class="pfc-header">
              <div class="pfc-dot" :style="{ background: p.color }"></div>
              <div class="pfc-name" :style="{ color: p.color }">{{ p.name }}</div>
              <div class="pfc-role">{{ p.role }}</div>
            </div>
            <textarea
              class="pfc-ta"
              v-model="form.playerFeedback[p.id]"
              :placeholder="`Feedback pour ${p.name}…`"
              @input="debounceSave"
            ></textarea>
          </div>
        </div>

        <!-- POST-SCRIM ANALYSIS -->
        <div class="sec-head">
          <div class="sec-dot" style="background:var(--green)"></div>
          Analyse post-scrim
        </div>
        <div class="obs-grid three-col">
          <div class="obs-card" style="border-left:2px solid var(--green)">
            <div class="obs-lbl" style="color:var(--green)">✦ Ce qui a bien fonctionné</div>
            <textarea class="obs-ta" v-model="form.wentWell" placeholder="Points positifs, stratégies réussies…" @input="debounceSave"></textarea>
          </div>
          <div class="obs-card" style="border-left:2px solid var(--red)">
            <div class="obs-lbl" style="color:var(--red)">✦ Ce qui a mal fonctionné</div>
            <textarea class="obs-ta" v-model="form.wentWrong" placeholder="Erreurs collectives, problèmes récurrents…" @input="debounceSave"></textarea>
          </div>
          <div class="obs-card" style="border-left:2px solid var(--yellow)">
            <div class="obs-lbl" style="color:var(--yellow)">✦ Axes d'amélioration</div>
            <textarea class="obs-ta" v-model="form.improvements" placeholder="Priorités de travail pour les prochaines sessions…" @input="debounceSave"></textarea>
          </div>
        </div>

        <!-- RATING + COMMENTS -->
        <div class="bottom-row">
          <div class="rating-block">
            <div class="rb-label">Note de session</div>
            <div class="rb-dots">
              <div
                v-for="n in 10" :key="n"
                class="rb-dot"
                :class="{ on: (form.rating || 0) >= n }"
                @click="form.rating = form.rating === n ? 0 : n; debounceSave()"
              ></div>
            </div>
            <div class="rb-num" :style="{ color: ratingColor }">{{ form.rating || 0 }} / 10</div>
          </div>
          <div class="field flex-1">
            <label>Commentaires généraux</label>
            <textarea v-model="form.comments" placeholder="Notes libres, observations du coach…" @input="debounceSave" style="min-height:80px"></textarea>
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
import { ClipboardList } from 'lucide-vue-next'
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import SyncStatus from '../components/SyncStatus.vue'
import LoadingScreen from '../components/LoadingScreen.vue'
import html2canvas from 'html2canvas'

const PLAYERS_LIST = [
  { id: 'boulou',  name: 'Boulou',   role: 'Top',     color: '#f97316' },
  { id: 'zugu',    name: 'Zugu',     role: 'Jungle',  color: '#22c55e' },
  { id: 'lakrael', name: 'Lakraël',  role: 'Mid',     color: '#3b82f6' },
  { id: 'ke1do',   name: 'Ke1do',    role: 'ADC',     color: '#ef4444' },
  { id: 'joordy',  name: 'Joordy',   role: 'Support', color: '#a855f7' },
]

const DOC_ID = 'scrim-sessions'

const loading    = ref(true)
const exporting  = ref(false)
const drawerOpen = ref(false)
const activeIdx  = ref(-1)

const syncState = ref('offline')
const syncText  = ref('En attente…')
const syncTime  = ref('')
const flashOk   = ref(null)

const sessions = ref([])

function defaultForm() {
  return {
    date: new Date().toISOString().split('T')[0],
    opponent: '',
    result: '',
    score: '',
    games: Array.from({ length: 5 }, () => ({ result: '', duration: '', side: '', kd: '' })),
    playerFeedback: { boulou: '', zugu: '', lakrael: '', ke1do: '', joordy: '' },
    wentWell: '',
    wentWrong: '',
    improvements: '',
    rating: 0,
    comments: '',
  }
}

const form = reactive(defaultForm())

let debTimer    = null
let unsubscribe = null

const ratingColor = computed(() => {
  const r = form.rating || 0
  if (r >= 8) return 'var(--green)'
  if (r >= 6) return 'var(--c1)'
  if (r >= 4) return 'var(--yellow)'
  if (r > 0)  return 'var(--red)'
  return 'var(--tx3)'
})

function setSyncState(s, t, tm = '') {
  syncState.value = s; syncText.value = t; syncTime.value = tm
}

function flash(ok) {
  flashOk.value = ok
  setTimeout(() => { flashOk.value = null }, 1600)
}

function debounceSave() {
  clearTimeout(debTimer)
  debTimer = setTimeout(save, 1000)
}

function getState() {
  return { sessions: JSON.parse(JSON.stringify(sessions.value)) }
}

function applyState(data) {
  if (!data) return
  sessions.value = Array.isArray(data.sessions) ? data.sessions : []
  if (activeIdx.value >= 0 && sessions.value[activeIdx.value]) {
    loadSession(activeIdx.value)
  }
}

async function save() {
  setSyncState('syncing', 'Sauvegarde…')
  try {
    // persist current form into sessions array
    if (activeIdx.value >= 0) {
      sessions.value[activeIdx.value] = JSON.parse(JSON.stringify(form))
    }
    await setDoc(doc(db, 'plazma', DOC_ID), getState())
    setSyncState('connected', 'Synchronisé')
    flash(true)
  } catch (e) {
    setSyncState('error', 'Erreur Firebase')
    flash(false)
    console.error(e)
  }
}

function openNewSession() {
  const newSession = defaultForm()
  sessions.value.unshift(newSession)
  activeIdx.value = 0
  loadSession(0)
  drawerOpen.value = false
  save()
}

function loadSession(i) {
  activeIdx.value = i
  const s = sessions.value[i]
  if (!s) return
  Object.assign(form, JSON.parse(JSON.stringify(s)))
  // ensure games array always has 5 entries
  while (form.games.length < 5) form.games.push({ result: '', duration: '', side: '', kd: '' })
  // ensure playerFeedback has all players
  PLAYERS_LIST.forEach(p => { if (!form.playerFeedback[p.id]) form.playerFeedback[p.id] = '' })
}

function deleteSession(i) {
  if (!confirm('Supprimer cette session ?')) return
  sessions.value.splice(i, 1)
  if (activeIdx.value === i) {
    activeIdx.value = -1
    Object.assign(form, defaultForm())
  } else if (activeIdx.value > i) {
    activeIdx.value--
  }
  save()
}

function exportBackup() {
  const b = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b)
  a.download = `plazma-scrims-${new Date().toISOString().split('T')[0]}.json`
  a.click()
}

function importBackup() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json'
  inp.addEventListener('change', async () => {
    try {
      const data = JSON.parse(await inp.files[0].text())
      applyState(data)
      save()
    } catch { alert('Fichier invalide') }
  })
  inp.click()
}

async function resetData() {
  if (!confirm('Réinitialiser toutes les sessions de scrim ?')) return
  sessions.value = []
  activeIdx.value = -1
  Object.assign(form, defaultForm())
  await deleteDoc(doc(db, 'plazma', DOC_ID))
  setSyncState('connected', 'Réinitialisé', '')
}

async function exportPng() {
  exporting.value = true
  const el = document.getElementById('scrimCard')
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link,.drawer').forEach(e => { e.style.visibility = 'hidden' })
  await new Promise(r => setTimeout(r, 80))
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#04111a', useCORS: true, logging: false })
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link,.drawer').forEach(e => { e.style.visibility = '' })
  exporting.value = false
  const a = document.createElement('a')
  a.download = `plazma-scrim-${form.date || 'report'}.png`
  a.href = canvas.toDataURL('image/png'); a.click()
}

function startSync() {
  if (unsubscribe) unsubscribe()
  setSyncState('syncing', 'Connexion…')
  unsubscribe = onSnapshot(doc(db, 'plazma', DOC_ID), snapshot => {
    if (snapshot.metadata.hasPendingWrites) return
    if (snapshot.exists()) applyState(snapshot.data())
    setSyncState('connected', 'Synchronisé', new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    loading.value = false
  }, err => {
    console.error(err)
    setSyncState('error', 'Erreur connexion')
    loading.value = false
  })
  setTimeout(() => {
    if (loading.value) { loading.value = false; setSyncState('error', 'Firebase inaccessible') }
  }, 8000)
}

onMounted(startSync)
onUnmounted(() => { if (unsubscribe) unsubscribe(); clearTimeout(debTimer) })
</script>

<style scoped>
.page-wrap { display: flex; flex-direction: column; align-items: center; padding: 28px 20px 80px; }

/* Toolbar extras */
.btn-new    { background: rgba(6,182,212,.1); border: 1px solid rgba(6,182,212,.3); color: var(--c1); }
.btn-new:hover { background: rgba(6,182,212,.2); }
.btn-drawer { background: var(--sf2); border: 1px solid var(--bd); color: var(--tx2); }
.btn-drawer:hover { border-color: var(--c1); color: var(--c1); }

/* Drawer */
.drawer { width: 100%; max-width: 920px; background: var(--sf); border: 1px solid var(--bd); border-radius: 8px; overflow: hidden; margin-bottom: 14px; max-height: 0; transition: max-height .35s cubic-bezier(.4,0,.2,1); }
.drawer.open { max-height: 420px; }
.drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--bd); }
.drawer-title { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: var(--c1); }
.drawer-count { font-size: 9px; color: var(--tx3); letter-spacing: 1px; }
.drawer-list { max-height: 340px; overflow-y: auto; padding: 6px 10px; display: flex; flex-direction: column; gap: 4px; }
.drawer-empty { color: var(--tx3); font-size: 12px; text-align: center; padding: 20px; }
.drawer-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg2); border: 1px solid var(--bd); border-radius: 4px; cursor: pointer; transition: border-color .15s, background .15s; clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%); }
.drawer-item:hover { border-color: rgba(6,182,212,.3); background: rgba(6,182,212,.03); }
.drawer-item.active { border-color: rgba(6,182,212,.5); background: rgba(6,182,212,.06); }
.di-left { display: flex; flex-direction: column; gap: 2px; }
.di-date { font-size: 9px; color: var(--tx3); letter-spacing: 1px; }
.di-opponent { font-size: 13px; font-weight: 600; color: var(--tx); }
.di-right { display: flex; align-items: center; gap: 8px; }
.di-result { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; padding: 2px 10px; border-radius: 3px; }
.di-result.w { background: rgba(34,197,94,.12); color: var(--green); border: 1px solid rgba(34,197,94,.25); }
.di-result.l { background: rgba(239,68,68,.12); color: var(--red); border: 1px solid rgba(239,68,68,.25); }
.di-result.d { background: rgba(245,158,11,.12); color: var(--yellow); border: 1px solid rgba(245,158,11,.25); }
.di-score { font-size: 11px; color: var(--tx2); min-width: 36px; text-align: center; }
.di-del { background: none; border: none; color: var(--tx3); font-size: 10px; cursor: pointer; padding: 2px 5px; transition: color .15s; opacity: 0; }
.drawer-item:hover .di-del { opacity: 1; }
.di-del:hover { color: var(--red) !important; }

/* Card */
.card { width: 100%; max-width: 920px; }
.header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.session-label { font-family: 'Rajdhani', sans-serif; font-size: 17px; font-weight: 700; color: var(--c1); letter-spacing: 1px; text-shadow: 0 0 16px rgba(6,182,212,.4); }
.week-label-sm { font-size: 8px; letter-spacing: 3px; text-transform: uppercase; color: var(--tx3); }

/* Section band */
.section-band { display: flex; align-items: center; gap: 10px; padding: 10px 32px; background: var(--sf); border-bottom: 1px solid var(--bd); }
.sb-icon { font-size: 14px; }
.sb-title { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: var(--tx3); }

/* Card body */
.card-body { padding: 22px 32px 28px; display: flex; flex-direction: column; gap: 20px; }

/* Form rows */
.form-row { display: grid; grid-template-columns: 1fr 2fr 1fr 1fr; gap: 12px; }
.field-sm { min-width: 0; }
.field-xs { min-width: 0; }

/* Games */
.games-list { display: flex; flex-direction: column; gap: 6px; }
.game-row { display: flex; align-items: center; gap: 12px; background: var(--sf); border: 1px solid var(--bd); padding: 10px 16px; clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%); }
.game-num { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; color: var(--tx3); min-width: 30px; }
.game-fields { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; flex: 1; }
.game-fields .field { margin-bottom: 0; }
.game-badge { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; padding: 2px 10px; border-radius: 3px; min-width: 32px; text-align: center; background: var(--bd); color: var(--tx3); }
.game-badge.w { background: rgba(34,197,94,.12); color: var(--green); border: 1px solid rgba(34,197,94,.25); }
.game-badge.l { background: rgba(239,68,68,.12); color: var(--red); border: 1px solid rgba(239,68,68,.25); }

/* Player feedback */
.players-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.player-feedback-card { background: var(--sf); border: 1px solid var(--bd); border-top: 2px solid var(--pc, var(--c1)); padding: 12px 14px; clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%); }
.pfc-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.pfc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.pfc-name { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 1px; flex: 1; }
.pfc-role { font-size: 9px; color: var(--tx3); letter-spacing: 1px; text-transform: uppercase; }
.pfc-ta { width: 100%; background: transparent; border: none; color: var(--tx2); font-size: 11px; font-family: 'Exo 2', sans-serif; line-height: 1.6; resize: none; outline: none; min-height: 80px; }
.pfc-ta::placeholder { color: var(--tx3); }

/* Analysis grid */
.obs-grid.three-col { grid-template-columns: 1fr 1fr 1fr; }

/* Bottom row */
.bottom-row { display: flex; gap: 20px; align-items: flex-start; }
.flex-1 { flex: 1; }
.rating-block { background: var(--sf); border: 1px solid var(--bd); padding: 14px 18px; flex-shrink: 0; clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%); }
.rb-label { font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); margin-bottom: 10px; }
.rb-dots { display: flex; gap: 5px; margin-bottom: 8px; }
.rb-dot { width: 24px; height: 12px; background: var(--bd2); border-radius: 2px; cursor: pointer; opacity: .2; transition: opacity .12s, transform .1s; clip-path: polygon(2px 0%,100% 0%,calc(100% - 2px) 100%,0% 100%); }
.rb-dot:hover { opacity: .5; transform: scaleY(1.2); }
.rb-dot.on { opacity: 1; background: var(--c1); }
.rb-num { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; text-align: center; transition: color .3s; }

@media(max-width:880px) {
  .form-row { grid-template-columns: 1fr 1fr; }
  .players-grid { grid-template-columns: 1fr 1fr; }
  .obs-grid.three-col { grid-template-columns: 1fr; }
  .game-fields { grid-template-columns: repeat(2, 1fr); }
  .bottom-row { flex-direction: column; }
  .card-body { padding: 14px 16px; }
}
@media(max-width:520px) {
  .form-row { grid-template-columns: 1fr; }
  .players-grid { grid-template-columns: 1fr; }
}
</style>
