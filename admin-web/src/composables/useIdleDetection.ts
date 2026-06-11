/**
 * 闲置检测组合式函数
 * 在用户无操作超时后，显示警告弹窗；超时未响应则自动登出
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

export interface IdleDetectionOptions {
  /** 闲置超时时间（毫秒），默认 30 分钟 */
  timeout?: number
  /** 警告倒计时（秒），默认 60 秒 */
  warningSeconds?: number
}

export function useIdleDetection(options: IdleDetectionOptions = {}) {
  const { timeout = 30 * 60 * 1000, warningSeconds = 60 } = options

  const showWarning = ref(false)
  const countdown = ref(warningSeconds)
  const idled = ref(false)

  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let countdownTimer: ReturnType<typeof setInterval> | null = null
  let warningTimer: ReturnType<typeof setTimeout> | null = null

  function resetIdle() {
    idled.value = false
    showWarning.value = false
    countdown.value = warningSeconds

    if (idleTimer) clearTimeout(idleTimer)
    if (countdownTimer) clearInterval(countdownTimer)
    if (warningTimer) clearTimeout(warningTimer)

    // 重新开始闲置计时
    idleTimer = setTimeout(() => {
      idled.value = true
      showWarning.value = true
      startCountdown()
    }, timeout)
  }

  function startCountdown() {
    countdownTimer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        handleLogout()
      }
    }, 1000)
  }

  function handleStay() {
    resetIdle()
  }

  function handleLogout() {
    if (countdownTimer) clearInterval(countdownTimer)
    if (warningTimer) clearTimeout(warningTimer)
    const auth = useAuthStore()
    auth.logout()
    router.push('/login')
  }

  function setupListeners() {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, resetIdle, { passive: true })
    })
  }

  function cleanupListeners() {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.removeEventListener(event, resetIdle)
    })
    if (idleTimer) clearTimeout(idleTimer)
    if (countdownTimer) clearInterval(countdownTimer)
    if (warningTimer) clearTimeout(warningTimer)
  }

  onMounted(() => {
    setupListeners()
    resetIdle()
  })

  onUnmounted(() => {
    cleanupListeners()
  })

  return {
    showWarning,
    countdown,
    handleStay,
    handleLogout,
    resetIdle,
  }
}
