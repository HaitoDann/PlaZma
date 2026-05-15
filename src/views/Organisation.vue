<template>
  <div class="org-layout">
    <LoadingScreen :visible="loading" label="Organisation" color="var(--purple)" />

    <!-- HEADER -->
    <div class="org-header">
      <div class="org-title-row">
        <RouterLink to="/" class="back-link">← Hub</RouterLink>
        <h1 class="org-title">🗂️ Organisation</h1>
        <div class="tab-switcher">
          <button
            v-for="tab in TABS"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </div>
        <button class="btn-export-png" :disabled="exporting" @click="exportPng">
          {{ exporting ? 'Export…' : '⬇ PNG' }}
        </button>
      </div>

      <SyncStatus
        :state="syncState"
        :text="syncText"
        :time="syncTime"
        :flash-ok="flashOk"
        @save="save"
        @backup="exportBackup"
        @import="triggerImport"
        @reset="resetData"
      />
      <input ref="importInput" type="file" accept=".json" style="display:none" @change="importBackup" />
    </div>

    <!-- GANTT VIEW -->
    <div v-show="activeTab === 'gantt'" id="view-gantt" class="view-wrap">
      <div class="gantt-toolbar">
        <button class="btn-add" @click="openTaskModal(null)">+ Ajouter une tâche</button>
        <div class="category-pills">
          <span
            v-for="cat in categories"
            :key="cat.name"
            class="cat-pill"
            :style="{ background: cat.color + '22', color: cat.color, border: '1px solid ' + cat.color + '66' }"
          >{{ cat.name }}</span>
        </div>
      </div>

      <div class="gantt-table-wrap">
        <table class="gantt-table">
          <thead>
            <tr>
              <th class="gt-name">Tâche</th>
              <th class="gt-cat">Catégorie</th>
              <th class="gt-who">Assigné</th>
              <th class="gt-date">Début</th>
              <th class="gt-date">Fin</th>
              <th class="gt-prog">Progression</th>
              <th class="gt-status">Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="task in ganttTasks"
              :key="task.id"
              class="gantt-row"
              @click="openTaskModal(task)"
            >
              <td class="gt-name">{{ task.name }}</td>
              <td class="gt-cat">
                <span
                  class="cat-badge"
                  :style="{ background: getCatColor(task.category) + '22', color: getCatColor(task.category) }"
                >{{ task.category }}</span>
              </td>
              <td class="gt-who">{{ task.assignee }}</td>
              <td class="gt-date">{{ task.start }}</td>
              <td class="gt-date">{{ task.end }}</td>
              <td class="gt-prog">
                <div class="prog-wrap">
                  <div class="prog-track">
                    <div
                      class="prog-fill"
                      :style="{ width: task.progress + '%', background: getCatColor(task.category) }"
                    ></div>
                  </div>
                  <span class="prog-val">{{ task.progress }}%</span>
                </div>
              </td>
              <td class="gt-status">
                <span class="status-chip" :class="task.status">{{ STATUS_LABELS[task.status] }}</span>
              </td>
            </tr>
            <tr v-if="!ganttTasks.length">
              <td colspan="7" class="empty-row">Aucune tâche. Cliquez "+ Ajouter une tâche".</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- KANBAN VIEW -->
    <div v-show="activeTab === 'kanban'" id="view-kanban" class="view-wrap">
      <div class="kanban-board">
        <div v-for="col in KANBAN_COLS" :key="col.id" class="kanban-col">
          <div class="kanban-col-header" :style="{ borderBottomColor: col.color }">
            <span class="kanban-col-title">{{ col.label }}</span>
            <span class="kanban-col-count">{{ getCards(col.id).length }}</span>
            <button class="kanban-add-btn" @click="openCardModal(col.id, null)">+</button>
          </div>
          <div class="kanban-cards">
            <div
              v-for="card in getCards(col.id)"
              :key="card.id"
              class="kanban-card"
              @click="openCardModal(col.id, card)"
            >
              <div class="card-prio-bar" :class="'prio-' + card.priority"></div>
              <div class="card-body">
                <div class="card-title">{{ card.title }}</div>
                <div v-if="card.description" class="card-desc">{{ card.description }}</div>
                <div class="card-meta">
                  <span class="card-prio-badge" :class="'prio-' + card.priority">{{ PRIO_LABELS[card.priority] }}</span>
                  <span v-if="card.assignee" class="card-assignee">{{ card.assignee }}</span>
                </div>
              </div>
            </div>
            <div v-if="!getCards(col.id).length" class="kanban-empty">Vide</div>
          </div>
        </div>
      </div>
    </div>

    <!-- RACI VIEW -->
    <div v-show="activeTab === 'raci'" id="view-raci" class="view-wrap">
      <div class="raci-toolbar">
        <button class="btn-add" @click="addRaciTask">+ Ajouter une tâche</button>
      </div>
      <div class="raci-table-wrap">
        <table class="raci-table">
          <thead>
            <tr>
              <th class="raci-task-col">Tâche</th>
              <th v-for="member in RACI_MEMBERS" :key="member" class="raci-member-col">{{ member }}</th>
              <th class="raci-del-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(task, idx) in raciTasks" :key="task.id">
              <td class="raci-task-name">
                <input
                  class="raci-name-input"
                  v-model="task.name"
                  placeholder="Nom de la tâche…"
                  @change="markDirty"
                />
              </td>
              <td v-for="member in RACI_MEMBERS" :key="member" class="raci-cell">
                <select class="raci-select" v-model="task.roles[member]" @change="markDirty">
                  <option value="">—</option>
                  <option value="R">R</option>
                  <option value="A">A</option>
                  <option value="C">C</option>
                  <option value="I">I</option>
                </select>
              </td>
              <td class="raci-del-col">
                <button class="raci-del-btn" @click="removeRaciTask(idx)">✕</button>
              </td>
            </tr>
            <tr v-if="!raciTasks.length">
              <td :colspan="RACI_MEMBERS.length + 2" class="empty-row">Aucune tâche. Cliquez "+ Ajouter une tâche".</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="raci-legend">
        <span><b>R</b> Responsible</span>
        <span><b>A</b> Accountable</span>
        <span><b>C</b> Consulted</span>
        <span><b>I</b> Informed</span>
      </div>
    </div>

    <!-- TASK MODAL (Gantt) -->
    <div class="overlay" :class="{ open: taskModal }" @click.self="taskModal = false">
      <div class="modal">
        <div class="modal-title">{{ editingTask ? 'Modifier la tâche' : 'Nouvelle tâche' }}</div>
        <div class="field-row">
          <div class="field">
            <label>Nom</label>
            <input v-model="tForm.name" placeholder="Nom de la tâche" />
          </div>
          <div class="field">
            <label>Catégorie</label>
            <select v-model="tForm.category">
              <option v-for="cat in categories" :key="cat.name" :value="cat.name">{{ cat.name }}</option>
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Début</label>
            <input type="date" v-model="tForm.start" />
          </div>
          <div class="field">
            <label>Fin</label>
            <input type="date" v-model="tForm.end" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Assigné</label>
            <input v-model="tForm.assignee" placeholder="ex: Boulou" />
          </div>
          <div class="field">
            <label>Statut</label>
            <select v-model="tForm.status">
              <option value="todo">À faire</option>
              <option value="progress">En cours</option>
              <option value="done">Terminé</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Progression : {{ tForm.progress }}%</label>
          <input type="range" min="0" max="100" v-model.number="tForm.progress" class="range-input" />
        </div>
        <div class="modal-actions">
          <button v-if="editingTask" class="btn-danger" @click="deleteTask">Supprimer</button>
          <button class="btn-cancel" @click="taskModal = false">Annuler</button>
          <button class="btn-save" @click="saveTask">Sauvegarder</button>
        </div>
      </div>
    </div>

    <!-- CARD MODAL (Kanban) -->
    <div class="overlay" :class="{ open: cardModal }" @click.self="cardModal = false">
      <div class="modal">
        <div class="modal-title">{{ editingCard ? 'Modifier la carte' : 'Nouvelle carte' }}</div>
        <div class="field">
          <label>Titre</label>
          <input v-model="cForm.title" placeholder="Titre de la carte" />
        </div>
        <div class="field">
          <label>Description</label>
          <textarea v-model="cForm.description" rows="3" placeholder="Description…"></textarea>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Priorité</label>
            <select v-model="cForm.priority">
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Basse</option>
            </select>
          </div>
          <div class="field">
            <label>Assigné</label>
            <input v-model="cForm.assignee" placeholder="ex: Zugu" />
          </div>
        </div>
        <div class="modal-actions">
          <button v-if="editingCard" class="btn-danger" @click="deleteCard">Supprimer</button>
          <button class="btn-cancel" @click="cardModal = false">Annuler</button>
          <button class="btn-save" @click="saveCard">Sauvegarder</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import html2canvas from 'html2canvas'
import SyncStatus from '../components/SyncStatus.vue'
import LoadingScreen from '../components/LoadingScreen.vue'

// ── Constants ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'gantt',  label: '📊 Gantt' },
  { id: 'kanban', label: '📋 Kanban' },
  { id: 'raci',   label: '🔲 RACI' },
]

const KANBAN_COLS = [
  { id: 'backlog',    label: 'Backlog',   color: '#6b7280' },
  { id: 'todo',       label: 'À faire',   color: '#3b82f6' },
  { id: 'inprogress', label: 'En cours',  color: '#f59e0b' },
  { id: 'done',       label: 'Terminé',   color: '#22c55e' },
]

const RACI_MEMBERS = ['Boulou', 'Zugu', 'Lakraël', 'Ke1do', 'Joordy', 'Coach']

const STATUS_LABELS = { todo: 'À faire', progress: 'En cours', done: 'Terminé' }
const PRIO_LABELS   = { high: '🔴 Haute', medium: '🟡 Moyenne', low: '🟢 Basse' }

const DEFAULT_CATEGORIES = [
  { name: 'Préparation',   color: '#3b82f6' },
  { name: 'Entraînement',  color: '#a855f7' },
  { name: 'Compétition',   color: '#ef4444' },
  { name: 'Communication', color: '#f59e0b' },
  { name: 'Développement', color: '#22c55e' },
]

// ── State ──────────────────────────────────────────────────────────────────
const loading     = ref(true)
const activeTab   = ref('gantt')
const exporting   = ref(false)
const importInput = ref(null)

const syncState = ref('offline')
const syncText  = ref('En attente…')
const syncTime  = ref('')
const flashOk   = ref(null)

const categories  = ref(DEFAULT_CATEGORIES.map(c => ({ ...c })))
const ganttTasks  = ref([])
const kanbanCards = ref([])
const raciTasks   = ref([])

// Task modal (Gantt)
const taskModal  = ref(false)
const editingTask = ref(null)
const tForm = reactive({
  name: '', category: 'Préparation', start: '', end: '',
  progress: 0, status: 'todo', assignee: '',
})

// Card modal (Kanban)
const cardModal   = ref(false)
const editingCard = ref(null)
const activeColId = ref('')
const cForm = reactive({ title: '', description: '', priority: 'medium', assignee: '' })

// ── Firebase ───────────────────────────────────────────────────────────────
const DOC_REF = doc(db, 'plazma', 'organisation')
let unsub = null

function applySnap(data) {
  categories.value  = data.categories  || DEFAULT_CATEGORIES.map(c => ({ ...c }))
  ganttTasks.value  = data.ganttTasks  || []
  kanbanCards.value = data.kanbanCards || []
  raciTasks.value   = data.raciTasks   || []
}

onMounted(() => {
  unsub = onSnapshot(DOC_REF, snap => {
    if (snap.exists()) applySnap(snap.data())
    syncState.value = 'live'
    syncText.value  = 'Connecté Firebase'
    syncTime.value  = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    loading.value   = false
  }, () => {
    syncState.value = 'offline'
    syncText.value  = 'Hors ligne'
    loading.value   = false
  })
})

onUnmounted(() => { if (unsub) unsub() })

function buildPayload() {
  return {
    categories:  categories.value,
    ganttTasks:  ganttTasks.value,
    kanbanCards: kanbanCards.value,
    raciTasks:   raciTasks.value,
  }
}

async function save() {
  try {
    await setDoc(DOC_REF, buildPayload())
    flashOk.value  = true
    syncState.value = 'live'
    syncText.value  = 'Sauvegardé'
    syncTime.value  = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    flashOk.value = false
  }
  setTimeout(() => { flashOk.value = null }, 2500)
}

function markDirty() {
  syncState.value = 'dirty'
  syncText.value  = 'Modifications non sauvegardées'
}

// ── Categories ─────────────────────────────────────────────────────────────
function getCatColor(name) {
  return (categories.value.find(c => c.name === name) || {}).color || '#888'
}

// ── Gantt tasks ────────────────────────────────────────────────────────────
function openTaskModal(task) {
  editingTask.value = task
  if (task) {
    Object.assign(tForm, { ...task })
  } else {
    Object.assign(tForm, {
      name: '', category: categories.value[0]?.name || '',
      start: '', end: '', progress: 0, status: 'todo', assignee: '',
    })
  }
  taskModal.value = true
}

function saveTask() {
  if (!tForm.name.trim()) return
  if (editingTask.value) {
    const idx = ganttTasks.value.findIndex(t => t.id === editingTask.value.id)
    if (idx !== -1) ganttTasks.value[idx] = { ...editingTask.value, ...tForm }
  } else {
    ganttTasks.value.push({ id: Date.now().toString(), ...tForm })
  }
  taskModal.value = false
  save()
}

function deleteTask() {
  ganttTasks.value = ganttTasks.value.filter(t => t.id !== editingTask.value.id)
  taskModal.value  = false
  save()
}

// ── Kanban cards ───────────────────────────────────────────────────────────
function getCards(colId) {
  return kanbanCards.value.filter(c => c.column === colId)
}

function openCardModal(colId, card) {
  activeColId.value = colId
  editingCard.value = card
  if (card) {
    Object.assign(cForm, { ...card })
  } else {
    Object.assign(cForm, { title: '', description: '', priority: 'medium', assignee: '' })
  }
  cardModal.value = true
}

function saveCard() {
  if (!cForm.title.trim()) return
  if (editingCard.value) {
    const idx = kanbanCards.value.findIndex(c => c.id === editingCard.value.id)
    if (idx !== -1) kanbanCards.value[idx] = { ...editingCard.value, ...cForm, column: activeColId.value }
  } else {
    kanbanCards.value.push({ id: Date.now().toString(), column: activeColId.value, ...cForm })
  }
  cardModal.value = false
  save()
}

function deleteCard() {
  kanbanCards.value = kanbanCards.value.filter(c => c.id !== editingCard.value.id)
  cardModal.value   = false
  save()
}

// ── RACI ───────────────────────────────────────────────────────────────────
function addRaciTask() {
  raciTasks.value.push({
    id: Date.now().toString(),
    name: '',
    roles: Object.fromEntries(RACI_MEMBERS.map(m => [m, ''])),
  })
  markDirty()
}

function removeRaciTask(idx) {
  raciTasks.value.splice(idx, 1)
  save()
}

// ── Export PNG ─────────────────────────────────────────────────────────────
async function exportPng() {
  exporting.value = true
  const el = document.getElementById(`view-${activeTab.value}`)
  if (!el) { exporting.value = false; return }
  try {
    const canvas = await html2canvas(el, { backgroundColor: '#0f0f15', scale: 2 })
    const link   = document.createElement('a')
    link.download = `organisation-${activeTab.value}-${Date.now()}.png`
    link.href     = canvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    console.error(e)
  }
  exporting.value = false
}

// ── Backup / Import / Reset ────────────────────────────────────────────────
function exportBackup() {
  const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href     = URL.createObjectURL(blob)
  link.download = `organisation-backup-${Date.now()}.json`
  link.click()
}

function triggerImport() {
  importInput.value?.click()
}

function importBackup(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async ev => {
    try {
      const data = JSON.parse(ev.target.result)
      applySnap(data)
      await save()
    } catch {
      alert('Fichier invalide.')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

async function resetData() {
  if (!confirm('Réinitialiser toutes les données Organisation ?')) return
  try {
    await deleteDoc(DOC_REF)
    categories.value  = DEFAULT_CATEGORIES.map(c => ({ ...c }))
    ganttTasks.value  = []
    kanbanCards.value = []
    raciTasks.value   = []
    flashOk.value = true
  } catch {
    flashOk.value = false
  }
  setTimeout(() => { flashOk.value = null }, 2500)
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────── */
.org-layout {
  min-height: 100vh;
  background: var(--bg, #0f0f15);
  color: var(--text, #e2e8f0);
  font-family: var(--font, 'Inter', sans-serif);
  display: flex;
  flex-direction: column;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.org-header {
  background: var(--surface, #1a1a2e);
  border-bottom: 1px solid rgba(255,255,255,.07);
  padding: 16px 24px 0;
  position: sticky;
  top: 0;
  z-index: 50;
}

.org-title-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding-bottom: 12px;
}

.org-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.back-link {
  color: var(--purple, #a855f7);
  text-decoration: none;
  font-size: .875rem;
  opacity: .8;
  transition: opacity .2s;
}
.back-link:hover { opacity: 1; }

.tab-switcher {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.tab-btn {
  padding: 6px 16px;
  border: 1px solid rgba(255,255,255,.12);
  background: transparent;
  color: var(--text, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
  font-size: .85rem;
  transition: background .2s, color .2s, border-color .2s;
}
.tab-btn.active {
  background: var(--purple, #a855f7);
  border-color: var(--purple, #a855f7);
  color: #fff;
}
.tab-btn:hover:not(.active) { background: rgba(255,255,255,.06); }

.btn-export-png {
  padding: 6px 14px;
  background: rgba(59,130,246,.15);
  border: 1px solid rgba(59,130,246,.4);
  color: #60a5fa;
  border-radius: 6px;
  cursor: pointer;
  font-size: .8rem;
  transition: background .2s;
}
.btn-export-png:hover:not(:disabled) { background: rgba(59,130,246,.28); }
.btn-export-png:disabled { opacity: .5; cursor: default; }

/* ── View wrapper ────────────────────────────────────────────────────────── */
.view-wrap {
  padding: 24px;
  flex: 1;
}

/* ── Shared toolbar / add button ─────────────────────────────────────────── */
.btn-add {
  padding: 7px 16px;
  background: rgba(168,85,247,.18);
  border: 1px solid rgba(168,85,247,.45);
  color: #c084fc;
  border-radius: 7px;
  cursor: pointer;
  font-size: .85rem;
  transition: background .2s;
}
.btn-add:hover { background: rgba(168,85,247,.3); }

.empty-row {
  text-align: center;
  padding: 32px;
  color: rgba(255,255,255,.3);
  font-style: italic;
}

/* ── Gantt ───────────────────────────────────────────────────────────────── */
.gantt-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.category-pills { display: flex; gap: 6px; flex-wrap: wrap; }

.cat-pill {
  padding: 2px 10px;
  border-radius: 20px;
  font-size: .75rem;
  font-weight: 600;
}

.gantt-table-wrap {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.07);
}

.gantt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .875rem;
}

.gantt-table th {
  background: rgba(255,255,255,.04);
  padding: 10px 14px;
  text-align: left;
  font-weight: 600;
  font-size: .78rem;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: rgba(255,255,255,.5);
  border-bottom: 1px solid rgba(255,255,255,.07);
  white-space: nowrap;
}

.gantt-row {
  border-bottom: 1px solid rgba(255,255,255,.04);
  cursor: pointer;
  transition: background .15s;
}
.gantt-row:hover { background: rgba(255,255,255,.04); }

.gantt-table td {
  padding: 10px 14px;
  vertical-align: middle;
}

.cat-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: .75rem;
  font-weight: 600;
}

.prog-wrap { display: flex; align-items: center; gap: 8px; }

.prog-track {
  height: 6px;
  background: rgba(255,255,255,.1);
  border-radius: 3px;
  overflow: hidden;
  width: 90px;
}
.prog-fill {
  height: 100%;
  border-radius: 3px;
  transition: width .3s;
}
.prog-val { font-size: .75rem; opacity: .7; min-width: 34px; }

.status-chip {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: .75rem;
  font-weight: 600;
}
.status-chip.todo     { background: rgba(107,114,128,.2); color: #9ca3af; }
.status-chip.progress { background: rgba(245,158,11,.18); color: #fbbf24; }
.status-chip.done     { background: rgba(34,197,94,.18);  color: #4ade80; }

/* ── Kanban ──────────────────────────────────────────────────────────────── */
.kanban-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  align-items: start;
}
@media (max-width: 900px)  { .kanban-board { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 520px)  { .kanban-board { grid-template-columns: 1fr; } }

.kanban-col {
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 10px;
  overflow: hidden;
}

.kanban-col-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 2px solid transparent;
  background: rgba(255,255,255,.03);
}

.kanban-col-title { font-weight: 700; font-size: .9rem; flex: 1; }

.kanban-col-count {
  font-size: .75rem;
  background: rgba(255,255,255,.1);
  border-radius: 10px;
  padding: 1px 7px;
  color: rgba(255,255,255,.6);
}

.kanban-add-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,.15);
  background: transparent;
  color: rgba(255,255,255,.6);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .2s;
}
.kanban-add-btn:hover { background: rgba(255,255,255,.1); }

.kanban-cards {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 80px;
}

.kanban-card {
  background: var(--surface, #1a1a2e);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s;
  display: flex;
}
.kanban-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,.3); }

.card-prio-bar { width: 4px; flex-shrink: 0; }
.card-prio-bar.prio-high   { background: #ef4444; }
.card-prio-bar.prio-medium { background: #f59e0b; }
.card-prio-bar.prio-low    { background: #22c55e; }

.card-body { padding: 10px 12px; flex: 1; }

.card-title { font-weight: 600; font-size: .875rem; margin-bottom: 4px; }

.card-desc {
  font-size: .78rem;
  color: rgba(255,255,255,.55);
  margin-bottom: 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta { display: flex; align-items: center; gap: 8px; }

.card-prio-badge { font-size: .7rem; padding: 1px 6px; border-radius: 4px; }
.card-prio-badge.prio-high   { background: rgba(239,68,68,.2);  color: #f87171; }
.card-prio-badge.prio-medium { background: rgba(245,158,11,.2); color: #fbbf24; }
.card-prio-badge.prio-low    { background: rgba(34,197,94,.2);  color: #4ade80; }

.card-assignee {
  font-size: .72rem;
  color: rgba(255,255,255,.45);
  margin-left: auto;
}

.kanban-empty {
  text-align: center;
  color: rgba(255,255,255,.2);
  font-size: .8rem;
  padding: 20px 0;
  font-style: italic;
}

/* ── RACI ────────────────────────────────────────────────────────────────── */
.raci-toolbar { margin-bottom: 16px; }

.raci-table-wrap {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.07);
}

.raci-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .875rem;
}

.raci-table th {
  background: rgba(255,255,255,.04);
  padding: 10px 14px;
  text-align: center;
  font-weight: 600;
  font-size: .78rem;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: rgba(255,255,255,.5);
  border-bottom: 1px solid rgba(255,255,255,.07);
  white-space: nowrap;
}

.raci-task-col  { text-align: left !important; min-width: 200px; }
.raci-member-col { min-width: 90px; }
.raci-del-col { width: 36px; }

.raci-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255,255,255,.04);
  text-align: center;
  vertical-align: middle;
}

.raci-task-name { text-align: left !important; }

.raci-name-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255,255,255,.12);
  color: var(--text, #e2e8f0);
  font-size: .875rem;
  width: 100%;
  padding: 4px 2px;
  outline: none;
  transition: border-color .2s;
}
.raci-name-input:focus { border-color: var(--purple, #a855f7); }

.raci-select {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
  color: var(--text, #e2e8f0);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: .85rem;
  cursor: pointer;
  outline: none;
  transition: border-color .2s;
}
.raci-select:focus { border-color: var(--purple, #a855f7); }

.raci-del-btn {
  background: transparent;
  border: none;
  color: rgba(239,68,68,.6);
  cursor: pointer;
  font-size: .9rem;
  padding: 4px 6px;
  border-radius: 4px;
  transition: color .2s, background .2s;
}
.raci-del-btn:hover { color: #ef4444; background: rgba(239,68,68,.1); }

.raci-legend {
  margin-top: 16px;
  display: flex;
  gap: 20px;
  font-size: .8rem;
  color: rgba(255,255,255,.45);
}
.raci-legend b { color: rgba(255,255,255,.7); }

/* ── Modal ───────────────────────────────────────────────────────────────── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  opacity: 0;
  pointer-events: none;
  transition: opacity .2s;
}
.overlay.open { opacity: 1; pointer-events: all; }

.modal {
  background: var(--surface, #1a1a2e);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 14px;
  padding: 28px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 20px 60px rgba(0,0,0,.5);
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.field label {
  font-size: .78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: rgba(255,255,255,.5);
}
.field input,
.field select,
.field textarea {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
  color: var(--text, #e2e8f0);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: .9rem;
  outline: none;
  transition: border-color .2s;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
}
.field input:focus,
.field select:focus,
.field textarea:focus { border-color: var(--purple, #a855f7); }

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.range-input {
  width: 100%;
  accent-color: var(--purple, #a855f7);
  padding: 0;
  border: none;
  background: transparent;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.btn-cancel {
  padding: 8px 18px;
  border: 1px solid rgba(255,255,255,.15);
  background: transparent;
  color: rgba(255,255,255,.7);
  border-radius: 7px;
  cursor: pointer;
  font-size: .875rem;
  transition: background .2s;
}
.btn-cancel:hover { background: rgba(255,255,255,.07); }

.btn-save {
  padding: 8px 20px;
  background: var(--purple, #a855f7);
  border: none;
  color: #fff;
  border-radius: 7px;
  cursor: pointer;
  font-weight: 600;
  font-size: .875rem;
  transition: opacity .2s;
}
.btn-save:hover { opacity: .85; }

.btn-danger {
  padding: 8px 18px;
  background: rgba(239,68,68,.18);
  border: 1px solid rgba(239,68,68,.4);
  color: #f87171;
  border-radius: 7px;
  cursor: pointer;
  font-size: .875rem;
  margin-right: auto;
  transition: background .2s;
}
.btn-danger:hover { background: rgba(239,68,68,.3); }
</style>
