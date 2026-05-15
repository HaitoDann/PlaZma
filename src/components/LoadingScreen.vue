<template>
  <Transition name="fade">
    <div v-if="visible" class="ls">
      <div class="ls-logo" :style="{ color: color }">{{ label }}</div>
      <div class="ls-bar"><div class="ls-fill" :style="{ background: color }"></div></div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: true },
  label:   { type: String,  default: 'RoZter' },
  color:   { type: String,  default: 'var(--c1)' },
})
</script>

<style scoped>
.fade-leave-active { transition: opacity .5s; }
.fade-leave-to { opacity: 0; }
</style>
