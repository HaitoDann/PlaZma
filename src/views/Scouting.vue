<template>
  <div class="page-wrap">
    <LoadingScreen :visible="loading" label="Scout" color="var(--c1)" />

    <RouterLink to="/" class="hub-link">← Hub RoZter</RouterLink>

    <div class="toolbar">
      <button class="btn btn-export" :disabled="exporting" @click="exportPng">
        {{ exporting ? 'Export…' : '⬇ Exporter PNG' }}
      </button>
      <button class="btn btn-new" @click="newReport">+ Nouveau rapport</button>
      <button class="btn btn-drawer" @click="drawerOpen = !drawerOpen">
        {{ drawerOpen ? '✕ Fermer' : '🔍 Historique' }}
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
        <div class="drawer-title">Rapports de scouting</div>
        <div class="drawer-count">{{ history.length }} rapport{{ history.length !== 1 ? 's' : '' }}</div>
      </div>
      <div class="drawer-list">
        <div v-if="history.length === 0" class="drawer-empty">Aucun rapport enregistré</div>
        <div
          v-for="(h, i) in history"
          :key="i"
          class="drawer-item"
          :class="{ active: historyIdx === i }"
          @click="loadHistory(i)"
        >
          <div class="di-left">
            <div class="di-date">{{ h.savedAt || '—' }}</div>
            <div class="di-opponent">{{ h.opponentName || 'Équipe inconnue' }}</div>
          </div>
          <div class="di-right">
            <div class="di-threat" :style="{ color: threatColor(h.threatLevel) }">
              Menace {{ h.threatLevel || 0 }}/10
            </div>
            <button class="di-del" @click.stop="deleteHistory(i)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN CARD -->
    <div class="card sc-card" id="scoutCard">
      <!-- HEADER -->
      <div class="card-header">
        <div class="header-left">
          <div class="logo-mark">PZ</div>
          <div>
            <div class="club-name">PlaZma Esport · RoZter</div>
            <div class="doc-type">Fiche de Scouting</div>
          </div>
        </div>
        <div class="header-right">
          <div class="week-label-sm">Équipe adverse</div>
          <input
            class="opponent-input"
            v-model="form.opponentName"
            placeholder="Nom de l'équipe…"
            @input="onOpponentInput"
          />
          <div class="season-tag">Saison 2026</div>
        </div>
      </div>

      <!-- THREAT GAUGE -->
      <div class="threat-band">
        <div class="threat-left">
          <div class="tl-label">Niveau de menace</div>
          <div class="tl-dots">
            <div
              v-for="n in 10" :key="n"
              class="tl-dot"
              :class="{ on: (form.threatLevel || 0) >= n }"
              :style="{ background: n <= 3 ? 'var(--green)' : n <= 6 ? 'var(--yellow)' : 'var(--red)' }"
              @click="form.threatLevel = form.threatLevel === n ? 0 : n; debounceSave()"
            ></div>
          </div>
          <div class="tl-num" :style="{ color: threatColor(form.threatLevel) }">
            {{ form.threatLevel || 0 }} / 10
          </div>
        </div>
        <div class="threat-bar-wrap">
          <div class="threat-track">
            <div
              class="threat-fill"
              :style="{
                width: ((form.threatLevel || 0) / 10 * 100) + '%',
                background: threatColor(form.threatLevel)
              }"
            ></div>
          </div>
          <div class="threat-label-row">
            <span style="color:var(--green)">Faible</span>
            <span style="color:var(--yellow)">Modéré</span>
            <span style="color:var(--red)">Élevé</span>
          </div>
        </div>
        <div class="win-prob-block">
          <div class="wp-label">Probabilité de victoire</div>
          <div class="wp-row">
            <input
              type="number" min="0" max="100"
              class="wp-input"
              :style="{ color: winProbColor }"
              v-model.number="form.winProb"
              @input="debounceSave"
            />
            <span class="wp-pct">%</span>
          </div>
          <div class="wp-track">
            <div class="wp-fill" :style="{ width: (form.winProb || 0) + '%', background: winProbColor }"></div>
          </div>
        </div>
      </div>

      <!-- CARD BODY -->
      <div class="card-body">

        <!-- PLAYER CARDS -->
        <div class="sec-head">
          <div class="sec-dot"></div>
          Joueurs adverses
        </div>
        <div class="enemy-players-grid">
          <div v-for="(ep, ei) in form.enemyPlayers" :key="ei" class="ep-card" :style="{ '--ec': ROLE_COLORS[ei] }">
            <div class="ep-header">
              <div class="ep-role-badge" :style="{ background: ROLE_COLORS[ei] + '18', color: ROLE_COLORS[ei], border: `1px solid ${ROLE_COLORS[ei]}30` }">
                {{ ROLES[ei] }}
              </div>
              <input class="ep-name" v-model="ep.name" placeholder="Pseudo…" @input="debounceSave" />
            </div>

            <div class="ep-danger">
              <div class="ep-danger-label">Dangerosité</div>
              <div class="ep-danger-dots">
                <div
                  v-for="n in 7" :key="n"
                  class="ep-dd"
                  :class="{ on: (ep.danger || 0) >= n }"
                  :style="{ background: n <= 2 ? 'var(--green)' : n <= 5 ? 'var(--yellow)' : 'var(--red)' }"
                  @click="ep.danger = ep.danger === n ? 0 : n; debounceSave()"
                ></div>
              </div>
            </div>

            <div class="ep-side">
              <div class="ep-side-label">Side préféré</div>
              <div class="ep-side-btns">
                <button
                  v-for="s in ['Blue','Red','Both']" :key="s"
                  class="ep-sb"
                  :class="{ active: ep.side === s, blue: s === 'Blue', red: s === 'Red', both: s === 'Both' }"
                  @click="ep.side = ep.side === s ? '' : s; debounceSave()"
                >{{ s }}</button>
              </div>
            </div>

            <div class="ep-field">
              <div class="ep-field-label">Champions joués</div>
              <textarea class="ep-ta" v-model="ep.champions" placeholder="Champs principaux…" @input="debounceSave"></textarea>
            </div>
            <div class="ep-field">
              <div class="ep-field-label">Notes</div>
              <textarea class="ep-ta" v-model="ep.notes" placeholder="Habitudes, patterns, points forts/faibles…" @input="debounceSave"></textarea>
            </div>
          </div>
        </div>

        <!-- DRAFT TENDENCIES -->
        <div class="sec-head">
          <div class="sec-dot" style="background:var(--purple)"></div>
          Tendances draft
        </div>
        <div class="obs-grid">
          <div class="obs-card" style="border-left:2px solid var(--c1)">
            <div class="obs-lbl" style="color:var(--c1)">✦ Picks prioritaires</div>
            <textarea class="obs-ta" v-model="form.draft.priorityPicks" placeholder="Champions souvent first-picked…" @input="debounceSave"></textarea>
          </div>
          <div class="obs-card" style="border-left:2px solid var(--red)">
            <div class="obs-lbl" style="color:var(--red)">✦ Bans prioritaires</div>
            <textarea class="obs-ta" v-model="form.draft.priorityBans" placeholder="Champions qu'ils banissent toujours…" @input="debounceSave"></textarea>
          </div>
          <div class="obs-card" style="border-left:2px solid var(--yellow)">
            <div class="obs-lbl" style="color:var(--yellow)">✦ Faiblesses draft</div>
            <textarea class="obs-ta" v-model="form.draft.weaknesses" placeholder="Compositions qu'ils gèrent mal…" @input="debounceSave"></textarea>
          </div>
          <div class="obs-card" style="border-left:2px solid var(--green)">
            <div class="obs-lbl" style="color:var(--green)">✦ Contre-picks</div>
            <textarea class="obs-ta" v-model="form.draft.counterPicks" placeholder="Nos picks pour contrer leur style…" @input="debounceSave"></textarea>
          </div>
        </div>

        <!-- TEAM ANALYSIS -->
        <div class="sec-head">
          <div class="sec-dot" style="background:var(--orange)"></div>
          Analyse d'équipe
        </div>
        <div class="obs-grid">
          <div class="obs-card" style="border-left:2px solid var(--green)">
            <div class="obs-lbl" style="color:var(--green)">✦ Forces de l'équipe</div>
            <textarea class="obs-ta" v-model="form.teamStrengths" placeholder="Ce qu'ils font bien collectivement…" @input="debounceSave"></textarea>
          </div>
          <div class="obs-card" style="border-left:2px solid var(--red)">
            <div class="obs-lbl" style="color:var(--red)">✦ Faiblesses de l'équipe</div>
            <textarea class="obs-ta" v-model="form.teamWeaknesses" placeholder="Leurs points faibles à exploiter…" @input="debounceSave"></textarea>
          </div>
        </div>

        <!-- GAME PLAN -->
        <div class="sec-head">
          <div class="sec-dot" style="background:var(--blue)"></div>
          Plan de jeu par phase
        </div>
        <div class="gameplan-grid">
          <div class="gp-card" style="--gpc:#22c55e">
            <div class="gp-phase">Early Game</div>
            <div class="gp-icon">🌅</div>
            <textarea class="gp-ta" v-model="form.gamePlan.early" placeholder="Objectifs en early game, qui on cible, qui on protège…" @input="debounceSave"></textarea>
          </div>
          <div class="gp-card" style="--gpc:#f59e0b">
            <div class="gp-phase">Mid Game</div>
            <div class="gp-icon">⚔️</div>
            <textarea class="gp-ta" v-model="form.gamePlan.mid" placeholder="Priorité objectifs, rotations, split vs teamfight…" @input="debounceSave"></textarea>
          </div>
          <div class="gp-card" style="--gpc:#ef4444">
            <div class="gp-phase">Condition de victoire</div>
            <div class="gp-icon">🏆</div>
            <textarea class="gp-ta" v-model="form.gamePlan.winCon" placeholder="Comment on gagne, nos win conditions spécifiques…" @input="debounceSave"></textarea>
          </div>
        </div>

        <!-- COUNTER-PICK TABLE -->
        <div class="sec-head">
          <div class="sec-dot" style="background:var(--pink)"></div>
          Table de contre-picks
        </div>
        <div class="cp-table">
          <div class="cpt-head">
            <div class="cpt-cell cpt-role">Rôle</div>
            <div class="cpt-cell">Joueur adverse</div>
            <div class="cpt-cell">Nos suggestions</div>
            <div class="cpt-cell">Raison</div>
          </div>
          <div v-for="(row, ri) in form.counterTable" :key="ri" class="cpt-row" :style="{ '--ctr': ROLE_COLORS[ri] }">
            <div class="cpt-cell cpt-role-cell" :style="{ color: ROLE_COLORS[ri] }">{{ ROLES[ri] }}</div>
            <div class="cpt-cell">
              <input class="cpt-inp" v-model="row.enemy" :placeholder="form.enemyPlayers[ri].name || 'Adversaire'" @input="debounceSave" />
            </div>
            <div class="cpt-cell">
              <input class="cpt-inp" v-model="row.picks" placeholder="Champs suggérés…" @input="debounceSave" />
            </div>
            <div class="cpt-cell">
              <input class="cpt-inp" v-model="row.reason" placeholder="Pourquoi ce contre-pick…" @input="debounceSave" />
            </div>
          </div>
        </div>

      </div>

      <!-- FOOTER -->
      <div class="card-footer">
        <div class="footer-brand">PlaZma Esport · RoZter · plazma-esport.fr</div>
        <div class="footer-meta" v-if="form.savedAt">Dernière màj : {{ form.savedAt }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import SyncStatus from '../components/SyncStatus.vue'
import LoadingScreen from '../components/LoadingScreen.vue'
import html2canvas from 'html2canvas'

const ROLES       = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']
const ROLE_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#ef4444', '#a855f7']

const HISTORY_DOC = 'scouting-history'

const loading    = ref(true)
const exporting  = ref(false)
const drawerOpen = ref(false)
const historyIdx = ref(-1)

const syncState = ref('offline')
const syncText  = ref('En attente…')
const syncTime  = ref('')
const flashOk   = ref(null)

const history = ref([])

function defaultEnemyPlayer() {
  return { name: '', danger: 0, side: '', champions: '', notes: '' }
}

function defaultForm() {
  return {
    opponentName:  '',
    savedAt:       '',
    threatLevel:   0,
    winProb:       50,
    enemyPlayers:  Array.from({ length: 5 }, defaultEnemyPlayer),
    draft:         { priorityPicks: '', priorityBans: '', weaknesses: '', counterPicks: '' },
    teamStrengths: '',
    teamWeaknesses:'',
    gamePlan:      { early: '', mid: '', winCon: '' },
    counterTable:  Array.from({ length: 5 }, () => ({ enemy: '', picks: '', reason: '' })),
  }
}

const form = reactive(defaultForm())

let debTimer        = null
let opponentDebTimer = null
let unsubscribeDoc  = null
let unsubHist       = null

const docSuffix = computed(() => {
  const name = (form.opponentName || '').trim().toLowerCase()
    .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return name || 'default'
})

const currentDocId = computed(() => `scouting-${docSuffix.value}`)

const winProbColor = computed(() => {
  const p = form.winProb || 0
  if (p >= 65) return 'var(--green)'
  if (p >= 45) return 'var(--yellow)'
  return 'var(--red)'
})

function threatColor(level) {
  const l = level || 0
  if (l >= 7) return 'var(--red)'
  if (l >= 4) return 'var(--yellow)'
  if (l > 0)  return 'var(--green)'
  return 'var(--tx3)'
}

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

function onOpponentInput() {
  clearTimeout(opponentDebTimer)
  opponentDebTimer = setTimeout(() => {
    startDocSync()
    debounceSave()
  }, 600)
}

function getFormSnapshot() {
  return JSON.parse(JSON.stringify(form))
}

function applyForm(data) {
  if (!data) return
  form.opponentName   = data.opponentName   || ''
  form.savedAt        = data.savedAt        || ''
  form.threatLevel    = data.threatLevel    ?? 0
  form.winProb        = data.winProb        ?? 50
  form.teamStrengths  = data.teamStrengths  || ''
  form.teamWeaknesses = data.teamWeaknesses || ''
  if (data.draft) Object.assign(form.draft, data.draft)
  if (data.gamePlan) Object.assign(form.gamePlan, data.gamePlan)
  if (Array.isArray(data.enemyPlayers)) {
    data.enemyPlayers.forEach((ep, i) => {
      if (form.enemyPlayers[i]) Object.assign(form.enemyPlayers[i], ep)
    })
  }
  if (Array.isArray(data.counterTable)) {
    data.counterTable.forEach((row, i) => {
      if (form.counterTable[i]) Object.assign(form.counterTable[i], row)
    })
  }
}

async function save() {
  setSyncState('syncing', 'Sauvegarde…')
  try {
    const snapshot = getFormSnapshot()
    snapshot.savedAt = new Date().toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    form.savedAt = snapshot.savedAt

    await setDoc(doc(db, 'plazma', currentDocId.value), snapshot)

    const histEntry = {
      docId:        currentDocId.value,
      opponentName: form.opponentName,
      threatLevel:  form.threatLevel,
      savedAt:      snapshot.savedAt,
    }
    const existingIdx = history.value.findIndex(h => h.docId === currentDocId.value)
    if (existingIdx >= 0) {
      history.value[existingIdx] = histEntry
    } else {
      history.value.unshift(histEntry)
    }
    await setDoc(doc(db, 'plazma', HISTORY_DOC), { entries: JSON.parse(JSON.stringify(history.value)) })

    setSyncState('connected', 'Synchronisé')
    flash(true)
  } catch (e) {
    setSyncState('error', 'Erreur Firebase')
    flash(false)
    console.error(e)
  }
}

function newReport() {
  if (unsubscribeDoc) { unsubscribeDoc(); unsubscribeDoc = null }
  historyIdx.value = -1
  const df = defaultForm()
  Object.assign(form, df)
  form.enemyPlayers = Array.from({ length: 5 }, defaultEnemyPlayer)
  form.counterTable = Array.from({ length: 5 }, () => ({ enemy: '', picks: '', reason: '' }))
  drawerOpen.value = false
}

function loadHistory(i) {
  historyIdx.value = i
  const entry = history.value[i]
  if (!entry) return
  form.opponentName = entry.opponentName || ''
  drawerOpen.value = false
  startDocSync()
}

function deleteHistory(i) {
  if (!confirm('Supprimer ce rapport de scouting ?')) return
  const entry = history.value[i]
  history.value.splice(i, 1)
  if (historyIdx.value === i) {
    historyIdx.value = -1
    newReport()
  } else if (historyIdx.value > i) {
    historyIdx.value--
  }
  deleteDoc(doc(db, 'plazma', entry.docId)).catch(console.error)
  setDoc(doc(db, 'plazma', HISTORY_DOC), { entries: JSON.parse(JSON.stringify(history.value)) }).catch(console.error)
}

function exportBackup() {
  const b = new Blob([JSON.stringify(getFormSnapshot(), null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b)
  a.download = `plazma-scout-${docSuffix.value}-${new Date().toISOString().split('T')[0]}.json`
  a.click()
}

function importBackup() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json'
  inp.addEventListener('change', async () => {
    try {
      const data = JSON.parse(await inp.files[0].text())
      applyForm(data)
      save()
    } catch { alert('Fichier invalide') }
  })
  inp.click()
}

async function resetData() {
  if (!confirm(`Réinitialiser le rapport de scouting pour ${form.opponentName || 'cette équipe'} ?`)) return
  await deleteDoc(doc(db, 'plazma', currentDocId.value))
  newReport()
  setSyncState('connected', 'Réinitialisé', '')
}

async function exportPng() {
  exporting.value = true
  const el = document.getElementById('scoutCard')
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link,.drawer').forEach(e => { e.style.visibility = 'hidden' })
  await new Promise(r => setTimeout(r, 80))
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#04111a', useCORS: true, logging: false })
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link,.drawer').forEach(e => { e.style.visibility = '' })
  exporting.value = false
  const a = document.createElement('a')
  a.download = `plazma-scout-${docSuffix.value}.png`
  a.href = canvas.toDataURL('image/png'); a.click()
}

function startDocSync() {
  if (unsubscribeDoc) { unsubscribeDoc(); unsubscribeDoc = null }
  setSyncState('syncing', 'Connexion…')
  unsubscribeDoc = onSnapshot(doc(db, 'plazma', currentDocId.value), snapshot => {
    if (snapshot.metadata.hasPendingWrites) return
    if (snapshot.exists()) applyForm(snapshot.data())
    setSyncState('connected', 'Synchronisé', new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    loading.value = false
  }, err => {
    console.error(err)
    setSyncState('error', 'Erreur connexion')
    loading.value = false
  })
}

function startHistorySync() {
  if (unsubHist) { unsubHist(); unsubHist = null }
  unsubHist = onSnapshot(doc(db, 'plazma', HISTORY_DOC), snapshot => {
    if (snapshot.metadata.hasPendingWrites) return
    if (snapshot.exists()) {
      const data = snapshot.data()
      if (Array.isArray(data.entries)) history.value = data.entries
    }
  }, console.error)
}

onMounted(() => {
  startHistorySync()
  startDocSync()
  setTimeout(() => {
    if (loading.value) { loading.value = false; setSyncState('error', 'Firebase inaccessible') }
  }, 8000)
})

onUnmounted(() => {
  if (unsubscribeDoc) unsubscribeDoc()
  if (unsubHist) unsubHist()
  clearTimeout(debTimer)
  clearTimeout(opponentDebTimer)
})
</script>

<style scoped>
.page-wrap { display: flex; flex-direction: column; align-items: center; padding: 28px 20px 80px; }

.btn-new    { background: rgba(6,182,212,.1); border: 1px solid rgba(6,182,212,.3); color: var(--c1); }
.btn-new:hover { background: rgba(6,182,212,.2); }
.btn-drawer { background: var(--sf2); border: 1px solid var(--bd); color: var(--tx2); }
.btn-drawer:hover { border-color: var(--c1); color: var(--c1); }

/* Drawer */
.drawer { width: 100%; max-width: 1060px; background: var(--sf); border: 1px solid var(--bd); border-radius: 8px; overflow: hidden; margin-bottom: 14px; max-height: 0; transition: max-height .35s cubic-bezier(.4,0,.2,1); }
.drawer.open { max-height: 400px; }
.drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--bd); }
.drawer-title { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: var(--c1); }
.drawer-count { font-size: 9px; color: var(--tx3); }
.drawer-list { max-height: 320px; overflow-y: auto; padding: 6px 10px; display: flex; flex-direction: column; gap: 4px; }
.drawer-empty { color: var(--tx3); font-size: 12px; text-align: center; padding: 20px; }
.drawer-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg2); border: 1px solid var(--bd); border-radius: 4px; cursor: pointer; transition: border-color .15s; clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%); }
.drawer-item:hover { border-color: rgba(6,182,212,.3); }
.drawer-item.active { border-color: rgba(6,182,212,.5); background: rgba(6,182,212,.05); }
.di-left { display: flex; flex-direction: column; gap: 2px; }
.di-date { font-size: 9px; color: var(--tx3); }
.di-opponent { font-size: 13px; font-weight: 600; color: var(--tx); }
.di-right { display: flex; align-items: center; gap: 10px; }
.di-threat { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; }
.di-del { background: none; border: none; color: var(--tx3); font-size: 10px; cursor: pointer; padding: 2px 5px; transition: color .15s; opacity: 0; }
.drawer-item:hover .di-del { opacity: 1; }
.di-del:hover { color: var(--red) !important; }

/* Card */
.sc-card { max-width: 1060px; }
.header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.week-label-sm { font-size: 8px; letter-spacing: 3px; text-transform: uppercase; color: var(--tx3); }
.opponent-input { background: transparent; border: none; border-bottom: 2px solid rgba(6,182,212,.3); color: var(--c1); font-family: 'Rajdhani', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 2px; text-align: right; outline: none; width: 260px; transition: border-color .2s; text-shadow: 0 0 16px rgba(6,182,212,.35); }
.opponent-input::placeholder { color: rgba(6,182,212,.25); }
.opponent-input:focus { border-bottom-color: var(--c1); }

/* Threat band */
.threat-band { display: flex; align-items: center; gap: 28px; padding: 16px 32px; background: var(--sf); border-bottom: 1px solid var(--bd); }
.threat-left { flex-shrink: 0; }
.tl-label { font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); margin-bottom: 8px; }
.tl-dots { display: flex; gap: 4px; margin-bottom: 6px; }
.tl-dot { width: 20px; height: 12px; border-radius: 2px; cursor: pointer; opacity: .15; transition: opacity .1s, transform .1s; clip-path: polygon(2px 0%,100% 0%,calc(100% - 2px) 100%,0% 100%); }
.tl-dot:hover { opacity: .5; transform: scaleY(1.2); }
.tl-dot.on { opacity: 1; }
.tl-num { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; transition: color .3s; }
.threat-bar-wrap { flex: 1; }
.threat-track { height: 8px; background: var(--bd2); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
.threat-fill { height: 100%; border-radius: 4px; transition: width .5s cubic-bezier(.4,0,.2,1), background .3s; }
.threat-label-row { display: flex; justify-content: space-between; font-size: 8px; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; }
.win-prob-block { flex-shrink: 0; min-width: 140px; }
.wp-label { font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); margin-bottom: 6px; }
.wp-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 6px; }
.wp-input { background: transparent; border: none; border-bottom: 2px solid var(--bd2); font-family: 'Rajdhani', sans-serif; font-size: 36px; font-weight: 700; width: 80px; text-align: center; outline: none; line-height: 1; transition: color .3s, border-color .2s; }
.wp-input:focus { border-bottom-color: var(--c1); }
.wp-pct { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 600; color: var(--tx3); }
.wp-track { height: 5px; background: var(--bd2); border-radius: 3px; overflow: hidden; }
.wp-fill { height: 100%; border-radius: 3px; transition: width .5s cubic-bezier(.4,0,.2,1), background .3s; }

/* Card body */
.card-body { padding: 22px 32px 28px; display: flex; flex-direction: column; gap: 22px; }

/* Enemy players */
.enemy-players-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.ep-card { background: var(--sf); border: 1px solid var(--bd); border-top: 2px solid var(--ec, var(--c1)); padding: 14px 12px; clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%); display: flex; flex-direction: column; gap: 10px; }
.ep-header { display: flex; flex-direction: column; gap: 6px; }
.ep-role-badge { font-family: 'Rajdhani', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 2px 8px; display: inline-block; clip-path: polygon(4px 0%,100% 0%,calc(100% - 4px) 100%,0% 100%); }
.ep-name { background: transparent; border: none; border-bottom: 1px solid var(--bd2); color: var(--tx); font-family: 'Exo 2', sans-serif; font-size: 13px; font-weight: 600; width: 100%; outline: none; padding: 3px 0; transition: border-color .2s; }
.ep-name::placeholder { color: var(--tx3); }
.ep-name:focus { border-bottom-color: var(--ec, var(--c1)); }
.ep-danger { display: flex; flex-direction: column; gap: 4px; }
.ep-danger-label, .ep-side-label, .ep-field-label { font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--tx3); }
.ep-danger-dots { display: flex; gap: 3px; }
.ep-dd { flex: 1; height: 8px; border-radius: 2px; cursor: pointer; opacity: .15; transition: opacity .1s; }
.ep-dd:hover { opacity: .5; }
.ep-dd.on { opacity: 1; }
.ep-side { display: flex; flex-direction: column; gap: 4px; }
.ep-side-btns { display: flex; gap: 3px; }
.ep-sb { flex: 1; background: var(--bg2); border: 1px solid var(--bd2); color: var(--tx3); font-size: 8px; font-weight: 700; letter-spacing: .5px; padding: 3px 2px; cursor: pointer; font-family: 'Exo 2', sans-serif; transition: all .15s; border-radius: 2px; }
.ep-sb.active.blue { background: rgba(59,130,246,.2); border-color: rgba(59,130,246,.5); color: var(--blue); }
.ep-sb.active.red  { background: rgba(239,68,68,.2); border-color: rgba(239,68,68,.5); color: var(--red); }
.ep-sb.active.both { background: rgba(168,85,247,.2); border-color: rgba(168,85,247,.5); color: var(--purple); }
.ep-field { display: flex; flex-direction: column; gap: 4px; }
.ep-ta { background: transparent; border: none; border-left: 2px solid var(--bd); color: var(--tx2); font-size: 10px; font-family: 'Exo 2', sans-serif; line-height: 1.6; resize: none; outline: none; min-height: 60px; padding-left: 8px; transition: border-color .2s; }
.ep-ta::placeholder { color: var(--tx3); }
.ep-ta:focus { border-left-color: var(--ec, var(--c1)); }

/* Game plan */
.gameplan-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.gp-card { background: var(--sf); border: 1px solid var(--bd); border-top: 2px solid var(--gpc, var(--c1)); padding: 16px 14px; clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%); }
.gp-phase { font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: var(--gpc, var(--c1)); margin-bottom: 4px; }
.gp-icon { font-size: 18px; margin-bottom: 8px; }
.gp-ta { width: 100%; background: transparent; border: none; color: var(--tx2); font-size: 12px; font-family: 'Exo 2', sans-serif; line-height: 1.7; resize: none; outline: none; min-height: 90px; }
.gp-ta::placeholder { color: var(--tx3); }

/* Counter-pick table */
.cp-table { background: var(--sf); border: 1px solid var(--bd); overflow: hidden; clip-path: polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%); }
.cpt-head { display: grid; grid-template-columns: 90px 1fr 1fr 1fr; background: var(--bg2); border-bottom: 1px solid var(--bd); }
.cpt-row  { display: grid; grid-template-columns: 90px 1fr 1fr 1fr; border-bottom: 1px solid var(--bd); border-left: 3px solid var(--ctr, var(--bd)); }
.cpt-row:last-child { border-bottom: none; }
.cpt-cell { padding: 9px 14px; font-size: 11px; color: var(--tx2); border-right: 1px solid var(--bd); }
.cpt-cell:last-child { border-right: none; }
.cpt-head .cpt-cell { font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); font-weight: 700; }
.cpt-role { min-width: 90px; }
.cpt-role-cell { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; display: flex; align-items: center; }
.cpt-inp { width: 100%; background: transparent; border: none; color: var(--tx2); font-size: 12px; font-family: 'Exo 2', sans-serif; outline: none; transition: color .2s; }
.cpt-inp::placeholder { color: var(--tx3); }
.cpt-inp:focus { color: var(--tx); }

/* Footer meta */
.footer-meta { font-size: 9px; color: var(--tx3); letter-spacing: 1px; }

@media(max-width:1000px) {
  .enemy-players-grid { grid-template-columns: 1fr 1fr; }
  .gameplan-grid { grid-template-columns: 1fr; }
  .threat-band { flex-direction: column; align-items: flex-start; gap: 16px; }
  .cpt-head, .cpt-row { grid-template-columns: 70px 1fr 1fr; }
  .cpt-row .cpt-cell:last-child, .cpt-head .cpt-cell:last-child { display: none; }
  .sc-card { max-width: 100%; }
}
@media(max-width:640px) {
  .enemy-players-grid { grid-template-columns: 1fr; }
  .obs-grid { grid-template-columns: 1fr; }
  .cpt-head, .cpt-row { grid-template-columns: 70px 1fr; }
  .cpt-row .cpt-cell:nth-child(3), .cpt-head .cpt-cell:nth-child(3) { display: none; }
  .card-body { padding: 14px 16px; }
  .opponent-input { width: 180px; font-size: 16px; }
}
</style>
