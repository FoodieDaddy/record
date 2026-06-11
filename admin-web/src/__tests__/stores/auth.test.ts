import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock localStorage
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, val: string) => { store[key] = val },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
})

import { useAuthStore } from '@/stores/auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.keys(store).forEach(k => delete store[k])
  })

  it('初始状态未登录', () => {
    const auth = useAuthStore()
    expect(auth.isLoggedIn).toBe(false)
    expect(auth.token).toBe('')
    expect(auth.username).toBe('')
    expect(auth.role).toBe('')
  })

  it('setAuth 设置登录态并持久化', () => {
    const auth = useAuthStore()
    auth.setAuth({ token: 'test-jwt', username: 'admin', role: 'SUPER_ADMIN' })
    expect(auth.isLoggedIn).toBe(true)
    expect(auth.username).toBe('admin')
    expect(auth.role).toBe('SUPER_ADMIN')
    expect(store['admin_token']).toBe('test-jwt')
    expect(store['admin_username']).toBe('admin')
    expect(store['admin_role']).toBe('SUPER_ADMIN')
  })

  it('logout 清除登录态和 localStorage', () => {
    const auth = useAuthStore()
    auth.setAuth({ token: 'test-jwt', username: 'admin', role: 'SUPER_ADMIN' })
    auth.logout()
    expect(auth.isLoggedIn).toBe(false)
    expect(auth.token).toBe('')
    expect(store['admin_token']).toBeUndefined()
    expect(store['admin_username']).toBeUndefined()
    expect(store['admin_role']).toBeUndefined()
  })

  it('从 localStorage 恢复登录态', () => {
    store['admin_token'] = 'stored-jwt'
    store['admin_username'] = 'stored-admin'
    store['admin_role'] = 'OPERATOR'
    const auth = useAuthStore()
    expect(auth.token).toBe('stored-jwt')
    expect(auth.username).toBe('stored-admin')
    expect(auth.role).toBe('OPERATOR')
    expect(auth.isLoggedIn).toBe(true)
  })
})
