<template>
  <Transition name="fade-root" mode="out-in">
    <RouterView :key="isLayout" />
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'

const route = useRoute()
const isLayout = computed(() => route.meta.public ? 'login' : 'app')
</script>

<style>
.fade-root-enter-active,
.fade-root-leave-active { transition: opacity 0.2s ease; }
.fade-root-enter-from,
.fade-root-leave-to     { opacity: 0; }
</style>
