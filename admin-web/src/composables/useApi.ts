import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import router from '@/router'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// 防止多个 401 同时触发多次登出/跳转
let isRedirecting = false

api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    const data = res.data
    if (data.code !== 200) {
      return Promise.reject(new Error(data.message || '请求失败'))
    }
    return data.data
  },
  async (err: AxiosError) => {
    const status = err.response?.status
    const original = err.config as InternalAxiosRequestConfig & { _retried?: boolean }

    // 401: 尝试刷新 Token（仅重试一次）
    if (status === 401 && original && !original._retried) {
      original._retried = true
      try {
        const auth = useAuthStore()
        const newToken = await refreshToken(original)
        if (newToken) {
          auth.token = newToken
          localStorage.setItem('admin_token', newToken)
          original.headers.Authorization = `Bearer ${newToken}`
          return api(original)
        }
      } catch { /* refresh failed, fall through to logout */ }

      if (!isRedirecting) {
        isRedirecting = true
        const auth = useAuthStore()
        auth.logout()
        router.push('/login')
        setTimeout(() => { isRedirecting = false }, 3000)
      }
    }

    // 403: 权限不足 — 仅提示，不登出
    if (status === 403) {
      try {
        const toast = useToastStore()
        toast.error('权限不足，无法执行此操作')
      } catch {}
      return Promise.reject(err)
    }

    // 其他错误：Toast 提示
    const message = (err.response?.data as any)?.message || err.message || '请求失败'
    try {
      const toast = useToastStore()
      toast.error(message)
    } catch {}
    return Promise.reject(err)
  }
)

/**
 * 尝试用当前 token 换取新 token
 * 后端需提供 POST /auth/refresh 接口
 * 若后端未实现则直接返回 null，走登出流程
 */
async function refreshToken(_config: InternalAxiosRequestConfig): Promise<string | null> {
  try {
    const auth = useAuthStore()
    const res = await axios.post('/api/auth/refresh', null, {
      headers: { Authorization: `Bearer ${auth.token}` },
      timeout: 5000,
    })
    return res.data?.data?.token || null
  } catch {
    return null
  }
}

export function useApi() {
  return api
}
