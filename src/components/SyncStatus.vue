<template>
  <div class="sync-bar">
    <div class="sync-indicator">
      <div class="sync-dot" :class="state"></div>
      <span class="sync-text" :style="{ color: stateColor }">{{ text }}</span>
      <span class="sync-time">{{ time }}</span>
    </div>
    <button class="btn-save-fb" :class="{ saved: flashOk === true, error: flashOk === false }" @click="$emit('save')">
      {{ flashOk === true ? '✓ Sauvegardé' : flashOk === false ? '⚠ Erreur' : '💾 Sauvegarder' }}
    </button>
    <div class="btn-mini-row">
      <button class="btn-mini" @click="$emit('backup')">📦 Backup</button>
      <button class="btn-mini" @click="$emit('import')">📥 Import</button>
      <button class="btn-mini red" @click="$emit('reset')">🗑 Reset</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  state:   { type: String, default: 'offline' },
  text:    { type: String, default: 'En attente…' },
  time:    { type: String, default: '' },
  flashOk: { type: Boolean, default: null },
})

defineEmits(['save', 'backup', 'import', 'reset'])

const stateColor = computed(() => ({
  connected: 'var(--green)',
  syncing:   'var(--yellow)',
  error:     'var(--red)',
  offline:   'var(--tx3)',
}[props.state] || 'var(--tx3)'))
</script>
