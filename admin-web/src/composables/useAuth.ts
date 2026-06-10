import { useApi } from './useApi'
import { useAuthStore } from '@/stores/auth'

export function useAuth() {
  const api = useApi()
  const auth = useAuthStore()

  async function login(username: string, password: string) {
    const data = await api.post('/admin/login', { username, password })
    auth.setAuth(data as any)
  }

  function logout() {
    auth.logout()
  }

  return { login, logout }
}
