import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('admin_token') || '')
  const username = ref(localStorage.getItem('admin_username') || '')
  const role = ref(localStorage.getItem('admin_role') || '')

  const isLoggedIn = computed(() => !!token.value)

  function setAuth(data: { token: string; username: string; role: string }) {
    token.value = data.token
    username.value = data.username
    role.value = data.role
    localStorage.setItem('admin_token', data.token)
    localStorage.setItem('admin_username', data.username)
    localStorage.setItem('admin_role', data.role)
  }

  function logout() {
    token.value = ''
    username.value = ''
    role.value = ''
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_username')
    localStorage.removeItem('admin_role')
  }

  return { token, username, role, isLoggedIn, setAuth, logout }
})
