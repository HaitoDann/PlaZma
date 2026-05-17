<template>
  <div class="bible-layout">
    <LoadingScreen :visible="loading" label="Bible" color="var(--purple)" />

    <!-- SIDEBAR -->
    <aside class="bible-sidebar">
      <div class="sb-header">
        <div class="sb-title"><BookOpen :size="16" style="color:var(--purple)" /> Bible</div>
      </div>

      <div class="sb-actions">
        <button class="sb-btn" @click="addArticle">+ Article</button>
        <button class="sb-btn" @click="addFolder">+ Dossier</button>
      </div>

      <div class="tree-scroll">
        <div v-for="folder in tree" :key="folder.id" class="tree-folder">
          <div
            class="tree-folder-header"
            :class="{ open: folder.open }"
            @click="toggleFolder(folder)"
          >
            <span class="folder-arrow">{{ folder.open ? '▾' : '▸' }}</span>
            <span v-if="!folder.renaming" class="folder-name">📁 {{ folder.name }}</span>
            <input
              v-else
              class="rename-input"
              v-model="folder.name"
              @blur="commitRename(folder)"
              @keydown.enter="commitRename(folder)"
              @click.stop
              autofocus
            />
          </div>

          <div v-show="folder.open" class="tree-articles">
            <div
              v-for="art in folder.articles"
              :key="art.id"
              class="tree-article"
              :class="{ active: activeArticleId === art.id }"
              @click="openArticle(art)"
            >
              <span class="art-icon">📄</span>
              <span v-if="!art.renaming" class="art-name">{{ art.title }}</span>
              <input
                v-else
                class="rename-input"
                v-model="art.title"
                @blur="commitRenameArt(art)"
                @keydown.enter="commitRenameArt(art)"
                @click.stop
                autofocus
              />
              <div class="art-actions" @click.stop>
                <button class="art-btn" title="Renommer" @click="startRename(art)">✏️</button>
                <button class="art-btn danger" title="Supprimer" @click="deleteArticle(folder, art)">🗑</button>
              </div>
            </div>
            <div v-if="!folder.articles.length" class="folder-empty">Vide</div>
          </div>

          <div class="folder-actions" @click.stop>
            <button class="art-btn" title="Renommer le dossier" @click="startRenameFolder(folder)">✏️</button>
            <button class="art-btn danger" title="Supprimer le dossier" @click="deleteFolder(folder)">🗑</button>
          </div>
        </div>
        <div v-if="!tree.length" class="tree-empty">Aucun dossier.</div>
      </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="bible-main">
      <div class="main-toolbar">
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

      <div v-if="activeArticle" class="editor-wrap">
        <div class="editor-header">
          <h2 class="editor-title">{{ activeArticle.title }}</h2>
          <div class="editor-meta">
            <span class="word-count">{{ wordCount }} mot{{ wordCount !== 1 ? 's' : '' }}</span>
            <span class="save-hint" :class="{ unsaved: editorDirty }">
              {{ editorDirty ? '● Non sauvegardé' : '✓ Sauvegardé' }}
            </span>
          </div>
        </div>
        <textarea
          class="editor-area"
          v-model="editorContent"
          placeholder="Commencez à écrire…"
          @input="onEditorInput"
          spellcheck="true"
        ></textarea>
        <div class="editor-footer">
          <button class="btn-save-art" @click="saveArticle">💾 Sauvegarder l'article</button>
        </div>
      </div>

      <div v-else class="editor-placeholder">
        <div class="placeholder-icon">📖</div>
        <div class="placeholder-text">Sélectionnez un article dans la sidebar</div>
        <div class="placeholder-sub">ou créez-en un nouveau avec "+ Article"</div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { BookOpen } from 'lucide-vue-next'
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import SyncStatus from '../components/SyncStatus.vue'
import LoadingScreen from '../components/LoadingScreen.vue'

// ── Default tree structure ─────────────────────────────────────────────────
function makeDefaultTree() {
  return [
    {
      id: 'f-strategies',
      name: 'Stratégies',
      open: true,
      articles: [
        { id: 'a-meta',   title: 'Meta actuelle' },
        { id: 'a-compos', title: 'Compositions' },
      ],
    },
    {
      id: 'f-processus',
      name: 'Processus',
      open: false,
      articles: [
        { id: 'a-scrim',   title: 'Routine de scrim' },
        { id: 'a-debrief', title: 'Débrief' },
      ],
    },
    {
      id: 'f-joueurs',
      name: 'Joueurs',
      open: false,
      articles: [
        { id: 'a-regles', title: "Règles d'équipe" },
      ],
    },
  ]
}

// ── State ──────────────────────────────────────────────────────────────────
const loading     = ref(true)
const importInput = ref(null)

const syncState = ref('offline')
const syncText  = ref('En attente…')
const syncTime  = ref('')
const flashOk   = ref(null)

const tree          = ref(makeDefaultTree())
const articlesMap   = ref({})    // { [id]: { title, content } }
const activeArticleId = ref(null)
const activeArticle  = ref(null)
const editorContent  = ref('')
const editorDirty    = ref(false)

const wordCount = computed(() => {
  const txt = editorContent.value.trim()
  if (!txt) return 0
  return txt.split(/\s+/).length
})

// ── Firebase ───────────────────────────────────────────────────────────────
const DOC_REF = doc(db, 'plazma', 'bible')
let unsub = null

function stripTransient(t) {
  // Remove Vue reactivity-only fields before saving
  return t.map(folder => ({
    id: folder.id,
    name: folder.name,
    open: folder.open,
    articles: folder.articles.map(a => ({ id: a.id, title: a.title })),
  }))
}

function applySnap(data) {
  if (data.tree) {
    // Merge open state & renaming flags
    tree.value = data.tree.map(folder => ({
      ...folder,
      open: folder.open ?? false,
      renaming: false,
      articles: (folder.articles || []).map(a => ({ ...a, renaming: false })),
    }))
  } else {
    tree.value = makeDefaultTree()
  }
  articlesMap.value = data.articles || {}
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
    tree:     stripTransient(tree.value),
    articles: articlesMap.value,
  }
}

async function save() {
  try {
    await setDoc(DOC_REF, buildPayload())
    flashOk.value   = true
    syncState.value = 'live'
    syncText.value  = 'Sauvegardé'
    syncTime.value  = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    flashOk.value = false
  }
  setTimeout(() => { flashOk.value = null }, 2500)
}

// ── Tree operations ────────────────────────────────────────────────────────
function toggleFolder(folder) {
  folder.open = !folder.open
}

function addFolder() {
  const id = 'f-' + Date.now()
  tree.value.push({ id, name: 'Nouveau dossier', open: true, renaming: true, articles: [] })
}

function addArticle() {
  if (!tree.value.length) {
    alert('Créez d\'abord un dossier.')
    return
  }
  // Add to first open folder, or first folder
  const target = tree.value.find(f => f.open) || tree.value[0]
  target.open = true
  const id  = 'a-' + Date.now()
  const art = { id, title: 'Nouvel article', renaming: true }
  target.articles.push(art)
  openArticle(art)
}

function openArticle(art) {
  // Save current if dirty
  if (editorDirty.value && activeArticleId.value) {
    articlesMap.value[activeArticleId.value] = {
      ...(articlesMap.value[activeArticleId.value] || {}),
      content: editorContent.value,
    }
  }
  activeArticleId.value = art.id
  activeArticle.value   = art
  const stored = articlesMap.value[art.id] || {}
  editorContent.value  = stored.content || ''
  editorDirty.value    = false
}

function onEditorInput() {
  editorDirty.value = true
}

async function saveArticle() {
  if (!activeArticleId.value) return
  articlesMap.value[activeArticleId.value] = {
    title:   activeArticle.value.title,
    content: editorContent.value,
  }
  editorDirty.value = false
  await save()
}

function startRename(art) {
  art.renaming = true
}

function commitRenameArt(art) {
  art.renaming = false
  if (articlesMap.value[art.id]) {
    articlesMap.value[art.id].title = art.title
  }
  save()
}

function startRenameFolder(folder) {
  folder.renaming = true
}

function commitRename(folder) {
  folder.renaming = false
  save()
}

function deleteArticle(folder, art) {
  if (!confirm(`Supprimer l'article "${art.title}" ?`)) return
  folder.articles = folder.articles.filter(a => a.id !== art.id)
  delete articlesMap.value[art.id]
  if (activeArticleId.value === art.id) {
    activeArticleId.value = null
    activeArticle.value   = null
    editorContent.value   = ''
    editorDirty.value     = false
  }
  save()
}

function deleteFolder(folder) {
  if (!confirm(`Supprimer le dossier "${folder.name}" et tous ses articles ?`)) return
  folder.articles.forEach(a => { delete articlesMap.value[a.id] })
  tree.value = tree.value.filter(f => f.id !== folder.id)
  if (folder.articles.some(a => a.id === activeArticleId.value)) {
    activeArticleId.value = null
    activeArticle.value   = null
    editorContent.value   = ''
    editorDirty.value     = false
  }
  save()
}

// ── Backup / Import / Reset ────────────────────────────────────────────────
function exportBackup() {
  const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href     = URL.createObjectURL(blob)
  link.download = `bible-backup-${Date.now()}.json`
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
  if (!confirm('Réinitialiser toute la Bible ?')) return
  try {
    await deleteDoc(DOC_REF)
    tree.value        = makeDefaultTree()
    articlesMap.value = {}
    activeArticleId.value = null
    activeArticle.value   = null
    editorContent.value   = ''
    editorDirty.value     = false
    flashOk.value = true
  } catch {
    flashOk.value = false
  }
  setTimeout(() => { flashOk.value = null }, 2500)
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────── */
.bible-layout {
  min-height: 100vh;
  display: flex;
  background: var(--bg, #0f0f15);
  color: var(--text, #e2e8f0);
  font-family: var(--font, 'Inter', sans-serif);
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.bible-sidebar {
  width: 260px;
  flex-shrink: 0;
  background: var(--surface, #1a1a2e);
  border-right: 1px solid rgba(255,255,255,.07);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: sticky;
  top: 0;
  height: 100vh;
}

.sb-header {
  padding: 16px 16px 8px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}

.back-link {
  display: block;
  color: var(--purple, #a855f7);
  text-decoration: none;
  font-size: .78rem;
  opacity: .8;
  margin-bottom: 6px;
  transition: opacity .2s;
}
.back-link:hover { opacity: 1; }

.sb-title {
  font-size: 1.1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sb-actions {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}

.sb-btn {
  flex: 1;
  padding: 6px 0;
  background: rgba(168,85,247,.15);
  border: 1px solid rgba(168,85,247,.35);
  color: #c084fc;
  border-radius: 6px;
  cursor: pointer;
  font-size: .78rem;
  font-weight: 600;
  transition: background .2s;
}
.sb-btn:hover { background: rgba(168,85,247,.28); }

/* ── Tree ────────────────────────────────────────────────────────────────── */
.tree-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.tree-folder {
  position: relative;
}

.tree-folder-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px 7px 10px;
  cursor: pointer;
  font-size: .875rem;
  font-weight: 600;
  border-radius: 6px;
  margin: 0 6px;
  transition: background .15s;
  user-select: none;
}
.tree-folder-header:hover { background: rgba(255,255,255,.04); }

.folder-arrow {
  font-size: .7rem;
  color: rgba(255,255,255,.4);
  width: 12px;
  flex-shrink: 0;
}

.folder-name { flex: 1; }

.tree-articles {
  padding: 2px 6px 4px 28px;
}

.tree-article {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: .85rem;
  transition: background .15s;
  margin-bottom: 1px;
}
.tree-article:hover { background: rgba(255,255,255,.04); }
.tree-article:hover .art-actions { opacity: 1; }
.tree-article.active {
  background: rgba(168,85,247,.18);
  color: #c084fc;
}

.art-icon { font-size: .8rem; flex-shrink: 0; }
.art-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.art-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity .15s;
  flex-shrink: 0;
}

.art-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: .75rem;
  padding: 2px 4px;
  border-radius: 4px;
  color: rgba(255,255,255,.5);
  transition: background .15s, color .15s;
}
.art-btn:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.85); }
.art-btn.danger:hover { background: rgba(239,68,68,.15); color: #f87171; }

.folder-actions {
  display: flex;
  gap: 2px;
  position: absolute;
  top: 6px;
  right: 10px;
  opacity: 0;
  transition: opacity .15s;
}
.tree-folder:hover .folder-actions { opacity: 1; }

.rename-input {
  flex: 1;
  background: rgba(255,255,255,.08);
  border: 1px solid var(--purple, #a855f7);
  color: var(--text, #e2e8f0);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: .85rem;
  outline: none;
  min-width: 0;
}

.folder-empty {
  font-size: .78rem;
  color: rgba(255,255,255,.2);
  padding: 4px 8px;
  font-style: italic;
}

.tree-empty {
  padding: 16px;
  text-align: center;
  font-size: .85rem;
  color: rgba(255,255,255,.25);
  font-style: italic;
}

/* ── Main content ────────────────────────────────────────────────────────── */
.bible-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.main-toolbar {
  border-bottom: 1px solid rgba(255,255,255,.07);
  background: var(--surface, #1a1a2e);
}

/* ── Editor ──────────────────────────────────────────────────────────────── */
.editor-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 0;
  min-height: 0;
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.editor-title {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
  flex: 1;
}

.editor-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.word-count {
  font-size: .78rem;
  color: rgba(255,255,255,.4);
  background: rgba(255,255,255,.05);
  padding: 2px 8px;
  border-radius: 20px;
}

.save-hint {
  font-size: .78rem;
  color: rgba(34,197,94,.7);
  transition: color .2s;
}
.save-hint.unsaved { color: rgba(245,158,11,.8); }

.editor-area {
  flex: 1;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.09);
  color: var(--text, #e2e8f0);
  border-radius: 10px;
  padding: 18px 20px;
  font-size: .95rem;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  line-height: 1.7;
  resize: none;
  outline: none;
  transition: border-color .2s;
  min-height: 300px;
}
.editor-area:focus { border-color: rgba(168,85,247,.45); }

.editor-footer {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}

.btn-save-art {
  padding: 8px 20px;
  background: var(--purple, #a855f7);
  border: none;
  color: #fff;
  border-radius: 7px;
  cursor: pointer;
  font-size: .875rem;
  font-weight: 600;
  transition: opacity .2s;
}
.btn-save-art:hover { opacity: .85; }

/* ── Placeholder ─────────────────────────────────────────────────────────── */
.editor-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgba(255,255,255,.25);
  padding: 40px;
}

.placeholder-icon { font-size: 3rem; }
.placeholder-text { font-size: 1rem; font-weight: 500; }
.placeholder-sub  { font-size: .85rem; }

/* ── Scrollbar ────────────────────────────────────────────────────────────── */
.tree-scroll::-webkit-scrollbar { width: 4px; }
.tree-scroll::-webkit-scrollbar-track { background: transparent; }
.tree-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }

.editor-area::-webkit-scrollbar { width: 6px; }
.editor-area::-webkit-scrollbar-track { background: transparent; }
.editor-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 3px; }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 700px) {
  .bible-sidebar {
    width: 100%;
    height: auto;
    position: static;
    max-height: 40vh;
  }
  .bible-layout { flex-direction: column; }
}
</style>
