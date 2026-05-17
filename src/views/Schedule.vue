<template>
  <div class="page-wrap">
    <LoadingScreen :visible="loading" />

    <div class="toolbar">
      <label>Semaine</label>
      <div class="week-nav">
        <button class="btn-wk" @click="shiftWeek(-1)">‹</button>
        <input type="week" v-model="weekValue" @change="onWeekChange">
        <button class="btn-wk" @click="shiftWeek(1)">›</button>
        <button class="btn-today" @click="goToday">Aujourd'hui</button>
      </div>
      <button class="btn btn-export" :disabled="exporting" @click="exportPng">{{ exporting ? 'Export…' : '⬇ Exporter PNG' }}</button>
    </div>

    <SyncStatus :state="syncState" :text="syncText" :time="syncTime" :flash-ok="flashOk" @save="save" @backup="exportBackup" @import="importBackup" @reset="resetData" />

    <div class="card" id="schedCard" style="max-width:1060px">
      <div class="card-header">
        <div class="header-left">
          <div class="logo-mark">PZ</div>
          <div>
            <div class="club-name">PlaZma Esport · RoZter</div>
            <div class="doc-type">Programme d'entraînement</div>
          </div>
        </div>
        <div class="header-right">
          <div class="week-label-sm">Semaine en cours</div>
          <div class="week-label-val">{{ weekDisplay }}</div>
          <div class="season-tag">Saison 2026</div>
        </div>
      </div>

      <div class="meta-band">
        <div class="mb-item"><div class="mb-dot"></div><div class="mb-label">League of Legends</div></div>
        <div class="mb-item"><div class="mb-dot"></div><div class="mb-label">Émeraude — Diamant</div></div>
        <div class="mb-item"><div class="mb-dot"></div><div class="mb-label">{{ totalSlots }} session{{ totalSlots > 1 ? 's' : '' }} cette semaine</div></div>
      </div>

      <div class="sched-grid">
        <div v-for="day in DAYS" :key="day" class="day-col">
          <div class="day-head">
            <div class="day-head-dot"></div>
            <div class="day-name">{{ day }}</div>
          </div>
          <div v-for="(slot, idx) in (schedule[day] || [])" :key="idx" class="slot" :style="{ background: getType(slot.type).bg, '--slot-color': getType(slot.type).color }" @click="openModal(day, idx)">
            <button class="slot-del" @click.stop="deleteSlot(day, idx)">✕</button>
            <div class="slot-type" :style="{ background: getType(slot.type).color + '18', color: getType(slot.type).color }">{{ getType(slot.type).label }}</div>
            <div v-if="slot.time" class="slot-time">⏱ {{ slot.time }}</div>
            <div class="slot-note">{{ slot.note }}</div>
          </div>
          <button class="add-slot" @click="addSlot(day)">+</button>
        </div>
      </div>

      <div class="legend-bar">
        <div class="legend-items">
          <div v-for="t in TYPES" :key="t.id" class="leg-pill" :style="{ background: t.color + '18', color: t.color }">{{ t.label }}</div>
        </div>
        <div class="footer-brand">plazma-esport.fr · RoZter</div>
      </div>
    </div>

    <!-- MODAL -->
    <div class="overlay" :class="{ open: modal }" @click.self="modal = false">
      <div class="modal-sched">
        <div class="modal-title">Modifier · {{ modalDay }}</div>
        <div class="field"><label>Type de session</label>
          <select v-model="mForm.type">
            <option v-for="t in TYPES" :key="t.id" :value="t.id">{{ t.label }}</option>
          </select>
        </div>
        <div class="field"><label>Horaires</label><input type="text" v-model="mForm.time" placeholder="ex: 19h00 – 22h00"></div>
        <div class="field"><label>Note</label><input type="text" v-model="mForm.note" placeholder="ex: Scrims vs Team X"></div>
        <div class="modal-actions">
          <button class="btn btn-cancel-sched" @click="modal = false">Annuler</button>
          <button class="btn btn-export" @click="saveSlot">Sauvegarder</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import html2canvas from 'html2canvas'
import SyncStatus from '../components/SyncStatus.vue'
import LoadingScreen from '../components/LoadingScreen.vue'

const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']

const TYPES = [
  { id:'scrim',    label:'Scrim',          color:'#3b82f6', bg:'rgba(59,130,246,.08)' },
  { id:'soloq',    label:'SoloQ',          color:'#ef4444', bg:'rgba(239,68,68,.08)' },
  { id:'repos',    label:'Repos',          color:'#22c55e', bg:'rgba(34,197,94,.08)' },
  { id:'match',    label:'Match Offi',     color:'#f97316', bg:'rgba(249,115,22,.08)' },
  { id:'coaching', label:'Coaching Indiv', color:'#ec4899', bg:'rgba(236,72,153,.08)' },
  { id:'review',   label:'Review VOD',     color:'#a855f7', bg:'rgba(168,85,247,.08)' },
  { id:'flexq',    label:'FlexQ',          color:'#f59e0b', bg:'rgba(245,158,11,.08)' },
  { id:'atelier',  label:'Atelier',        color:'#2dd4bf', bg:'rgba(45,212,191,.08)' },
  { id:'autre',    label:'Autre',          color:'#94a3b8', bg:'rgba(148,163,184,.06)' },
]

const DEFAULT_SCHEDULE = {
  Lundi:    [{ type:'scrim',    time:'19h00 – 22h00', note:'Scrims inter-équipes' }],
  Mardi:    [{ type:'soloq',   time:'18h00 – 21h00', note:'SoloQ individuel' }],
  Mercredi: [{ type:'review',  time:'19h00 – 20h30', note:'Review match précédent' },{ type:'scrim',time:'21h00 – 23h00',note:'Scrims' }],
  Jeudi:    [{ type:'coaching',time:'19h00 – 20h00', note:'Coaching joueur mid' }],
  Vendredi: [{ type:'scrim',   time:'20h00 – 23h00', note:'Scrims ranked' }],
  Samedi:   [{ type:'match',   time:'15h00 – 18h00', note:'Match officiel' }],
  Dimanche: [{ type:'repos',   time:'',              note:'Jour de repos' }],
}

const loading   = ref(true)
const exporting  = ref(false)
const syncState = ref('offline')
const syncText  = ref('En attente…')
const syncTime  = ref('')
const flashOk   = ref(null)
const modal     = ref(false)
const modalDay  = ref('')
const modalIdx  = ref(0)
const mForm     = reactive({ type:'scrim', time:'', note:'' })
const schedule  = reactive(JSON.parse(JSON.stringify(DEFAULT_SCHEDULE)))
const weekValue = ref(currentWeekValue())

function getType(id) { return TYPES.find(t => t.id === id) || TYPES[8] }
function currentWeekValue() {
  const n = new Date(); return `${n.getFullYear()}-W${String(getWeekNum(n)).padStart(2,'0')}`
}
function getWeekNum(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day)
  const y1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - y1) / 86400000) + 1) / 7)
}
const weekDisplay = computed(() => {
  const val = weekValue.value
  const [yr, wk] = val.split('-W').map(Number); if (!yr || !wk) return val
  const base = new Date(yr, 0, 1 + (wk - 1) * 7); const day = base.getDay()
  const mon = new Date(base); mon.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = d => d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })
  return `S${wk} · ${fmt(mon)} – ${fmt(sun)} ${yr}`
})
const totalSlots = computed(() => Object.values(schedule).reduce((a, s) => a + (s?.length || 0), 0))

function shiftWeek(delta) {
  const [yr, wk] = weekValue.value.split('-W').map(Number)
  const base = new Date(yr, 0, 1 + (wk - 1) * 7); const day = base.getDay()
  const mon = new Date(base); mon.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
  mon.setDate(mon.getDate() + delta * 7)
  weekValue.value = `${mon.getFullYear()}-W${String(getWeekNum(mon)).padStart(2,'0')}`
  onWeekChange()
}
function goToday() { weekValue.value = currentWeekValue(); onWeekChange() }

function addSlot(day) {
  if (!schedule[day]) schedule[day] = []
  schedule[day].push({ type:'scrim', time:'', note:'' })
  save()
}
function deleteSlot(day, idx) { schedule[day].splice(idx, 1); save() }
function openModal(day, idx) {
  modalDay.value = day; modalIdx.value = idx
  const s = schedule[day][idx]
  Object.assign(mForm, { type: s.type, time: s.time || '', note: s.note || '' })
  modal.value = true
}
function saveSlot() {
  Object.assign(schedule[modalDay.value][modalIdx.value], { type: mForm.type, time: mForm.time, note: mForm.note })
  modal.value = false; save()
}

function getDocId() { return 'schedule-' + weekValue.value }

const syncState_ = ref('offline')
let unsubscribe = null
function onWeekChange() {
  DAYS.forEach(d => { schedule[d] = [] })
  startSync()
}

function setSyncState(s, t, tm = '') { syncState.value = s; syncText.value = t; syncTime.value = tm }

async function save() {
  setSyncState('syncing', 'Sauvegarde…')
  try {
    await setDoc(doc(db, 'plazma', getDocId()), { schedule: Object.fromEntries(DAYS.map(d => [d, schedule[d] || []])) })
    setSyncState('connected', 'Synchronisé'); flash(true)
  } catch(e) { setSyncState('error', 'Erreur Firebase'); flash(false); console.error(e) }
}
function flash(ok) { flashOk.value = ok; setTimeout(() => { flashOk.value = null }, 1600) }
function exportBackup() { const b = new Blob([JSON.stringify({ schedule }, null, 2)], { type:'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `plazma-schedule-${weekValue.value}.json`; a.click() }
function importBackup() { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.addEventListener('change', async () => { try { const d = JSON.parse(await i.files[0].text()); if (d.schedule) { DAYS.forEach(day => { schedule[day] = d.schedule[day] || [] }); save() } } catch { alert('Fichier invalide') } }); i.click() }
function resetData() { if (!confirm('Effacer le planning de cette semaine ?')) return; DAYS.forEach(d => { schedule[d] = [] }); deleteDoc(doc(db, 'plazma', getDocId())).then(() => setSyncState('connected', 'Réinitialisé', '')) }

function startSync() {
  if (unsubscribe) unsubscribe()
  setSyncState('syncing', 'Connexion…')
  unsubscribe = onSnapshot(doc(db, 'plazma', getDocId()), snapshot => {
    if (snapshot.metadata.hasPendingWrites) return
    if (snapshot.exists()) {
      const data = snapshot.data()
      if (data.schedule) DAYS.forEach(day => { schedule[day] = data.schedule[day] || [] })
    }
    setSyncState('connected', 'Synchronisé', new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }))
    loading.value = false
  }, err => { console.error(err); setSyncState('error', 'Erreur connexion'); loading.value = false })
  setTimeout(() => { if (loading.value) { loading.value = false; setSyncState('error', 'Firebase inaccessible') } }, 8000)
}

async function exportPng() {
  exporting.value = true
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link,.slot-del,.add-slot').forEach(e => { e.style.visibility = 'hidden' })
  await new Promise(r => setTimeout(r, 80))
  const canvas = await html2canvas(document.getElementById('schedCard'), { scale:2, backgroundColor:'#04111a', useCORS:true, logging:false })
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link,.slot-del,.add-slot').forEach(e => { e.style.visibility = '' })
  exporting.value = false
  const a = document.createElement('a'); a.download = `rozter-${weekValue.value}.png`; a.href = canvas.toDataURL('image/png'); a.click()
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.value = false })
onMounted(startSync)
onUnmounted(() => { if (unsubscribe) unsubscribe() })
</script>

<style scoped>
.page-wrap { display:flex;flex-direction:column;align-items:center;padding:28px 20px 80px; }
.week-nav { display:flex;align-items:center;gap:5px; }
input[type="week"] { background:var(--sf2);border:1px solid var(--bd2);color:var(--tx);padding:7px 14px;font-size:12px;font-family:'Exo 2',sans-serif;outline:none;color-scheme:dark;transition:border-color .2s;clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%); }
.btn-wk { background:var(--sf2);border:1px solid var(--bd2);color:var(--tx2);width:32px;height:32px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%); }
.btn-wk:hover { border-color:var(--c1);color:var(--c1); }
.btn-today { background:rgba(6,182,212,.08);border:1px solid rgba(6,182,212,.25);color:var(--c1);padding:0 12px;height:32px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:'Exo 2',sans-serif;transition:all .15s;white-space:nowrap;clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%); }
.btn-today:hover { background:rgba(6,182,212,.18); }
.header-right { display:flex;flex-direction:column;align-items:flex-end;gap:5px; }
.week-label-sm { font-size:8px;letter-spacing:3px;text-transform:uppercase;color:var(--tx3); }
.week-label-val { font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:700;color:var(--c1);letter-spacing:1px;white-space:nowrap;text-shadow:0 0 16px rgba(6,182,212,.4); }
.meta-band { border-bottom:1px solid var(--bd);background:var(--sf);padding:10px 32px;display:flex;align-items:center;gap:24px; }
.mb-item { display:flex;align-items:center;gap:8px; }
.mb-dot { width:5px;height:5px;flex-shrink:0;clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);background:var(--c1); }
.mb-label { font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3); }
.sched-grid { display:grid;grid-template-columns:repeat(7,1fr); }
.day-col { padding:14px 10px 12px;border-right:1px solid var(--bd);background:var(--bg2);min-height:200px;transition:background .12s; }
.day-col:last-child { border-right:none; }
.day-col:hover { background:rgba(6,182,212,.018); }
.day-head { margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:6px; }
.day-head-dot { width:4px;height:4px;flex-shrink:0;border-radius:50%;background:var(--bd2);transition:background .15s; }
.day-col:hover .day-head-dot { background:var(--c1); }
.day-name { font-family:'Rajdhani',sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--tx3); }
.day-col:hover .day-name { color:var(--tx2); }
.slot { position:relative;padding:9px 10px 9px 12px;margin-bottom:6px;background:var(--sf);border:1px solid var(--bd);border-left:2px solid var(--slot-color,var(--bd));cursor:pointer;transition:background .1s,border-color .1s;clip-path:polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,0 100%); }
.slot:hover { background:var(--sf2);border-color:var(--bd2); }
.slot-type { font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:2px 7px;margin-bottom:5px;display:inline-block;clip-path:polygon(4px 0%,100% 0%,calc(100% - 4px) 100%,0% 100%); }
.slot-time { font-size:9px;color:var(--tx3);margin-bottom:3px;letter-spacing:.3px; }
.slot-note { font-size:11px;color:var(--tx2);line-height:1.4;font-weight:500; }
.slot-del { position:absolute;top:5px;right:6px;background:none;border:none;color:var(--bd2);font-size:10px;cursor:pointer;opacity:0;transition:opacity .15s,color .15s;line-height:1;padding:0; }
.slot:hover .slot-del { opacity:1; }
.slot-del:hover { color:var(--red) !important; }
.add-slot { width:100%;background:none;border:1px dashed var(--bd);color:var(--tx3);font-size:14px;padding:5px;cursor:pointer;transition:all .15s;line-height:1;margin-top:4px;font-family:'Exo 2',sans-serif;clip-path:polygon(4px 0%,100% 0%,calc(100% - 4px) 100%,0% 100%); }
.add-slot:hover { border-color:var(--c1);color:var(--c1); }
.legend-bar { border-top:1px solid var(--bd);background:var(--sf);padding:12px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px; }
.legend-items { display:flex;gap:7px;flex-wrap:wrap;align-items:center; }
.leg-pill { padding:2px 9px;font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;clip-path:polygon(4px 0%,100% 0%,calc(100% - 4px) 100%,0% 100%); }
.footer-brand { font-family:'Rajdhani',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--tx3); }
.overlay { display:none;position:fixed;inset:0;background:rgba(2,12,16,.92);backdrop-filter:blur(10px);z-index:300;align-items:center;justify-content:center; }
.overlay.open { display:flex; }
.modal-sched { background:var(--bg2);border:1px solid var(--bd2);padding:28px 26px;width:400px;max-width:95vw;box-shadow:0 0 80px rgba(0,0,0,.8);clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px)); }
.modal-title { font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--c1);margin-bottom:22px; }
.field { margin-bottom:14px; }
.field label { display:block;font-size:8.5px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);margin-bottom:6px; }
.field input,.field select { width:100%;background:var(--sf);border:1px solid var(--bd2);color:var(--tx);padding:9px 12px;font-size:13px;font-family:'Exo 2',sans-serif;outline:none;transition:border-color .2s;clip-path:polygon(4px 0%,100% 0%,calc(100% - 4px) 100%,0% 100%); }
.field input:focus,.field select:focus { border-color:var(--c1); }
.field select option { background:var(--sf); }
.modal-actions { display:flex;gap:8px;margin-top:22px; }
.btn-cancel-sched { flex:1;background:var(--sf);color:var(--tx2);border:1px solid var(--bd2); }
.btn-cancel-sched:hover { border-color:var(--c1);color:var(--c1); }
@media(max-width:1100px){ .sched-grid{grid-template-columns:1fr} .day-col{border-right:none;border-bottom:1px solid var(--bd)} .card-header{flex-direction:column;align-items:flex-start} .header-right{align-items:flex-start} }
</style>
