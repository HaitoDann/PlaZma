import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(sessionStorage.getItem('pz_auth') === '1')

  function login(password) {
    const valid = password === (import.meta.env.VITE_APP_PASSWORD || 'plazma2026')
    if (valid) {
      sessionStorage.setItem('pz_auth', '1')
      isAuthenticated.value = true
    }
    return valid
  }

  function logout() {
    sessionStorage.removeItem('pz_auth')
    isAuthenticated.value = false
  }

  return { isAuthenticated, login, logout }
})
