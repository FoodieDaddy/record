import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('admin_token') || '')
  const username = ref('')
  const role = ref('')

  const isLoggedIn = computed(() => !!token.value)

  function setAuth(data: { token: string; username: string; role: string }) {
    token.value = data.token
    username.value = data.username
    role.value = data.role
    localStorage.setItem('admin_token', data.token)
  }

  function logout() {
    token.value = ''
    username.value = ''
    role.value = ''
    localStorage.removeItem('admin_token')
  }

  return { token, username, role, isLoggedIn, setAuth, logout }
})
