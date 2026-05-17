<template>
  <div class="page-wrap">
    <LoadingScreen :visible="loading" color="var(--purple)" />

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

    <div class="card" id="draftCard">

      <!-- HEADER -->
      <div class="card-header">
        <div class="header-left">
          <div class="logo-mark">PZ</div>
          <div>
            <div class="club-name">PlaZma Esport · RoZter</div>
            <div class="doc-type">Préparation Draft</div>
          </div>
        </div>
        <div class="header-right">
          <GitBranch :size="32" style="color:var(--purple);opacity:0.7" />
          <div>
            <div class="header-sub">Draft & Champion Pool</div>
            <div class="season-tag">Saison 2026</div>
          </div>
        </div>
      </div>

      <div class="card-body">

        <!-- META PATCH -->
        <section>
          <div class="sec-head"><div class="sec-dot" style="background:var(--purple)"></div>Méta & Patch</div>
          <div class="meta-grid">
            <div class="field">
              <label>Numéro de patch</label>
              <input v-model="form.patchNumber" type="text" placeholder="ex: 14.12" @input="debounceSave" />
            </div>
            <div class="field">
              <label>Picks OP ce patch</label>
              <textarea v-model="form.opPicks" placeholder="Champions forts ce patch…" rows="3" @input="debounceSave"></textarea>
            </div>
            <div class="field">
              <label>Bans globaux recommandés</label>
              <textarea v-model="form.globalBans" placeholder="Champions à bannir systématiquement…" rows="3" @input="debounceSave"></textarea>
            </div>
          </div>
        </section>

        <!-- CHAMPION POOLS -->
        <section>
          <div class="sec-head"><div class="sec-dot" style="background:var(--purple)"></div>Champion Pools par joueur</div>
          <div class="player-tabs">
            <button
              v-for="p in PLAYERS" :key="p.id"
              class="ptab"
              :class="{ active: activePlayer === p.id }"
              :style="activePlayer === p.id ? { background: p.color + '22', borderColor: p.color, color: p.color } : {}"
              @click="activePlayer = p.id"
            >
              {{ p.name }}<span class="ptab-role">{{ p.role }}</span>
            </button>
          </div>
          <div v-for="p in PLAYERS" v-show="activePlayer === p.id" :key="p.id + '-pool'" class="tier-grid">
            <div
              v-for="tier in TIERS" :key="tier.label"
              class="tier-row"
              :style="{ borderLeft: `3px solid ${tier.color}` }"
            >
              <div class="tier-label" :style="{ color: tier.color }">{{ tier.label }}</div>
              <textarea
                class="tier-ta"
                v-model="form.pools[p.id][tier.label]"
                :placeholder="tier.placeholder"
                rows="2"
                @input="debounceSave"
              ></textarea>
            </div>
          </div>
        </section>

        <!-- DRAFT SIMULATOR -->
        <section>
          <div class="sec-head"><div class="sec-dot" style="background:var(--blue)"></div>Simulateur de Draft</div>
          <div class="draft-sim">
            <div class="draft-side blue-side">
              <div class="side-title" style="color:var(--blue)">◆ Blue Side</div>
              <div class="ban-row">
                <div class="ban-label">Bans</div>
                <div class="ban-slots">
                  <input v-for="i in 3" :key="'bb'+i" class="draft-inp ban-inp" v-model="form.draft.blueBans[i-1]" :placeholder="'B'+i" @input="debounceSave" />
                </div>
              </div>
              <div class="pick-list">
                <div v-for="(pos, i) in POSITIONS" :key="'bp'+i" class="pick-row">
                  <div class="pick-pos">{{ pos }}</div>
                  <input class="draft-inp" v-model="form.draft.bluePicks[i]" :placeholder="'Pick ' + (i+1)" @input="debounceSave" />
                </div>
              </div>
            </div>
            <div class="draft-vs">VS</div>
            <div class="draft-side red-side">
              <div class="side-title" style="color:var(--red)">◆ Red Side</div>
              <div class="ban-row">
                <div class="ban-label">Bans</div>
                <div class="ban-slots">
                  <input v-for="i in 3" :key="'rb'+i" class="draft-inp ban-inp" v-model="form.draft.redBans[i-1]" :placeholder="'B'+i" @input="debounceSave" />
                </div>
              </div>
              <div class="pick-list">
                <div v-for="(pos, i) in POSITIONS" :key="'rp'+i" class="pick-row">
                  <div class="pick-pos">{{ pos }}</div>
                  <input class="draft-inp" v-model="form.draft.redPicks[i]" :placeholder="'Pick ' + (i+1)" @input="debounceSave" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- TARGET COMPOSITIONS -->
        <section>
          <div class="sec-head"><div class="sec-dot" style="background:var(--green)"></div>Compositions cibles</div>
          <div class="comp-grid">
            <div v-for="(comp, i) in form.targetComps" :key="i" class="comp-card">
              <div class="comp-num">0{{ i + 1 }}</div>
              <div class="field">
                <label>Nom de la composition</label>
                <input v-model="comp.name" type="text" placeholder="ex: Full engage, Poke + scaling…" @input="debounceSave" />
              </div>
              <div class="field">
                <label>Style de jeu</label>
                <select v-model="comp.style" @change="debounceSave">
                  <option value="">— Choisir un style —</option>
                  <option value="teamfight">Teamfight</option>
                  <option value="poke">Poke</option>
                  <option value="splitpush">Splitpush</option>
                  <option value="engage">Engage</option>
                  <option value="protect">Protect the carry</option>
                  <option value="scaling">Scaling</option>
                  <option value="skirmish">Skirmish</option>
                </select>
              </div>
              <div class="field">
                <label>Condition de victoire</label>
                <textarea v-model="comp.winCon" placeholder="Comment gagne-t-on avec cette compo ?" rows="3" @input="debounceSave"></textarea>
              </div>
            </div>
          </div>
        </section>

        <!-- BAN PLAN vs OPPONENT -->
        <section>
          <div class="sec-head"><div class="sec-dot" style="background:var(--red)"></div>Plan de bans vs adversaire</div>
          <div class="field" style="max-width:320px">
            <label>Adversaire ciblé</label>
            <input v-model="form.banPlan.opponent" type="text" placeholder="Nom de l'équipe adverse" @input="debounceSave" />
          </div>
          <div class="ban-plan-grid">
            <div v-for="i in 5" :key="'banp'+i" class="banp-row">
              <div class="banp-n">{{ i }}</div>
              <input class="banp-inp" v-model="form.banPlan.bans[i-1]" type="text" :placeholder="'Champion à bannir #' + i" @input="debounceSave" />
            </div>
          </div>
        </section>

      </div>

      <!-- FOOTER -->
      <div class="card-footer">
        <div class="footer-brand">PlaZma Esport · RoZter · plazma-esport.fr</div>
        <div class="footer-sigs">
          <div class="sig"><div class="sig-line"></div><div class="sig-label">Coach</div></div>
          <div class="sig"><div class="sig-line"></div><div class="sig-label">Analyste</div></div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { GitBranch } from 'lucide-vue-next'
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import SyncStatus from '../components/SyncStatus.vue'
import LoadingScreen from '../components/LoadingScreen.vue'
import html2canvas from 'html2canvas'

const loading   = ref(true)
const exporting = ref(false)
const activePlayer = ref('boulou')

const syncState = ref('offline')
const syncText  = ref('En attente…')
const syncTime  = ref('')
const flashOk   = ref(null)

const PLAYERS = [
  { id: 'boulou',  name: 'Boulou',  role: 'Top',     color: '#f97316' },
  { id: 'zugu',    name: 'Zugu',    role: 'Jungle',  color: '#22c55e' },
  { id: 'lakrael', name: 'Lakraël', role: 'Mid',     color: '#3b82f6' },
  { id: 'ke1do',   name: 'Ke1do',   role: 'ADC',     color: '#ef4444' },
  { id: 'joordy',  name: 'Joordy',  role: 'Support', color: '#a855f7' },
]

const TIERS = [
  { label: 'S', color: '#f59e0b', placeholder: 'Champions maîtrisés, picks prioritaires…' },
  { label: 'A', color: '#22c55e', placeholder: 'Champions solides, bons en ranked…' },
  { label: 'B', color: '#3b82f6', placeholder: 'Champions corrects, à améliorer…' },
  { label: 'C', color: '#a855f7', placeholder: 'Champions en apprentissage…' },
  { label: 'D', color: '#ef4444', placeholder: 'Champions à éviter en compétitif…' },
]

const POSITIONS = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

function makeDefaultPools() {
  const pools = {}
  PLAYERS.forEach(p => {
    pools[p.id] = {}
    TIERS.forEach(t => { pools[p.id][t.label] = '' })
  })
  return pools
}

const form = reactive({
  patchNumber: '',
  opPicks: '',
  globalBans: '',
  pools: makeDefaultPools(),
  draft: {
    blueBans:  ['', '', ''],
    redBans:   ['', '', ''],
    bluePicks: ['', '', '', '', ''],
    redPicks:  ['', '', '', '', ''],
  },
  targetComps: [
    { name: '', style: '', winCon: '' },
    { name: '', style: '', winCon: '' },
    { name: '', style: '', winCon: '' },
  ],
  banPlan: {
    opponent: '',
    bans: ['', '', '', '', ''],
  },
})

let debTimer    = null
let unsubscribe = null

function setSyncState(state, text, time = '') {
  syncState.value = state; syncText.value = text; syncTime.value = time
}

function flash(ok) {
  flashOk.value = ok
  setTimeout(() => { flashOk.value = null }, 1600)
}

function getState() {
  return JSON.parse(JSON.stringify(form))
}

function applyState(s) {
  if (!s) return
  if (s.patchNumber  !== undefined) form.patchNumber  = s.patchNumber
  if (s.opPicks      !== undefined) form.opPicks      = s.opPicks
  if (s.globalBans   !== undefined) form.globalBans   = s.globalBans
  if (s.pools) {
    PLAYERS.forEach(p => {
      if (s.pools[p.id]) {
        TIERS.forEach(t => {
          form.pools[p.id][t.label] = s.pools[p.id][t.label] || ''
        })
      }
    })
  }
  if (s.draft) {
    form.draft.blueBans  = s.draft.blueBans  || ['', '', '']
    form.draft.redBans   = s.draft.redBans   || ['', '', '']
    form.draft.bluePicks = s.draft.bluePicks || ['', '', '', '', '']
    form.draft.redPicks  = s.draft.redPicks  || ['', '', '', '', '']
  }
  if (s.targetComps) {
    s.targetComps.forEach((c, i) => {
      if (form.targetComps[i]) Object.assign(form.targetComps[i], c)
    })
  }
  if (s.banPlan) {
    form.banPlan.opponent = s.banPlan.opponent || ''
    form.banPlan.bans     = s.banPlan.bans     || ['', '', '', '', '']
  }
}

async function save() {
  setSyncState('syncing', 'Sauvegarde…')
  try {
    await setDoc(doc(db, 'plazma', 'draft'), getState())
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
  a.download = `plazma-draft-${new Date().toISOString().split('T')[0]}.json`
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
  if (!confirm('Réinitialiser toute la préparation draft ?')) return
  form.patchNumber = ''; form.opPicks = ''; form.globalBans = ''
  form.pools = makeDefaultPools()
  form.draft = { blueBans: ['','',''], redBans: ['','',''], bluePicks: ['','','','',''], redPicks: ['','','','',''] }
  form.targetComps = [{ name:'',style:'',winCon:'' },{ name:'',style:'',winCon:'' },{ name:'',style:'',winCon:'' }]
  form.banPlan = { opponent: '', bans: ['','','','',''] }
  await deleteDoc(doc(db, 'plazma', 'draft'))
  setSyncState('connected', 'Réinitialisé', '')
}

async function exportPng() {
  exporting.value = true
  const el = document.getElementById('draftCard')
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link').forEach(e => { e.style.visibility = 'hidden' })
  await new Promise(r => setTimeout(r, 80))
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#04111a', useCORS: true, logging: false })
  document.querySelectorAll('.toolbar,.sync-bar,.hub-link').forEach(e => { e.style.visibility = '' })
  exporting.value = false
  const a = document.createElement('a')
  a.download = `plazma-draft-${new Date().toISOString().split('T')[0]}.png`
  a.href = canvas.toDataURL('image/png'); a.click()
}

onMounted(() => {
  setSyncState('syncing', 'Connexion…')
  unsubscribe = onSnapshot(doc(db, 'plazma', 'draft'), snapshot => {
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
.card { max-width: 960px; }
.header-right { display: flex; align-items: center; gap: 12px; }
.header-icon { font-size: 32px; }
.header-sub { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); }

.meta-grid { display: grid; grid-template-columns: 160px 1fr 1fr; gap: 12px; align-items: start; }

.player-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.ptab {
  display: flex; align-items: center; gap: 6px;
  background: var(--sf); border: 1px solid var(--bd); color: var(--tx3);
  padding: 7px 14px; font-size: 12px; font-weight: 700; letter-spacing: 1px;
  cursor: pointer; font-family: 'Exo 2', sans-serif; transition: all .18s;
  clip-path: polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%);
}
.ptab:hover { color: var(--tx2); }
.ptab-role { font-size: 9px; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; color: inherit; opacity: .7; }

.tier-grid { display: flex; flex-direction: column; gap: 7px; }
.tier-row { display: flex; align-items: flex-start; gap: 12px; background: var(--sf); border: 1px solid var(--bd); padding: 10px 14px; }
.tier-label { font-family: 'Rajdhani', sans-serif; font-size: 28px; font-weight: 700; min-width: 30px; line-height: 1; }
.tier-ta { flex: 1; background: transparent; border: none; color: var(--tx2); font-size: 12px; font-family: 'Exo 2', sans-serif; line-height: 1.7; resize: none; outline: none; }
.tier-ta::placeholder { color: var(--tx3); }

.draft-sim { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: start; }
.draft-vs { font-family: 'Rajdhani', sans-serif; font-size: 22px; font-weight: 700; color: var(--tx3); letter-spacing: 3px; padding-top: 32px; }
.side-title { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 12px; }
.ban-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.ban-label { font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); white-space: nowrap; }
.ban-slots { display: flex; gap: 5px; flex: 1; }
.draft-inp { background: var(--sf); border: 1px solid var(--bd); color: var(--tx); padding: 7px 10px; font-size: 12px; font-family: 'Exo 2', sans-serif; outline: none; transition: border-color .2s; width: 100%; }
.draft-inp:focus { border-color: var(--purple); }
.ban-inp { width: 70px; flex-shrink: 0; }
.pick-list { display: flex; flex-direction: column; gap: 5px; }
.pick-row { display: flex; align-items: center; gap: 8px; }
.pick-pos { font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); min-width: 52px; }

.comp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.comp-card { background: var(--sf); border: 1px solid var(--bd); padding: 16px; position: relative; clip-path: polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%); }
.comp-num { font-family: 'Rajdhani', sans-serif; font-size: 32px; font-weight: 700; color: var(--bd2); margin-bottom: 10px; }

.ban-plan-grid { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.banp-row { display: flex; align-items: center; gap: 10px; }
.banp-n { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; color: var(--red); min-width: 24px; }
.banp-inp { flex: 1; max-width: 400px; background: var(--sf); border: 1px solid var(--bd); border-left: 2px solid var(--red); color: var(--tx); padding: 8px 12px; font-size: 13px; font-family: 'Exo 2', sans-serif; outline: none; transition: border-color .2s; }
.banp-inp:focus { border-color: var(--red); }

@media(max-width:780px) {
  .meta-grid { grid-template-columns: 1fr; }
  .draft-sim { grid-template-columns: 1fr; }
  .draft-vs { padding-top: 0; text-align: center; }
  .comp-grid { grid-template-columns: 1fr; }
}
</style>
