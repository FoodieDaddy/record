<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useToastStore } from '@/stores/toast'
import { useLocaleStore } from '@/stores/locale'

const router = useRouter()
const { login } = useAuth()
const toast = useToastStore()
const locale = useLocaleStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = locale.isZh ? '请输入账号和密码' : 'Please enter username and password'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await login(username.value, password.value)
    toast.success(locale.isZh ? '权限接入完成' : 'Access granted')
    router.push('/dashboard')
  } catch (e: any) {
    const msg = e?.message || ''
    const status = e?.response?.status
    if (status === 429) {
      error.value = locale.isZh ? '登录请求过于频繁，请稍后再试' : 'Too many login attempts, please try again later'
    } else if (msg.includes('锁定')) {
      error.value = msg
    } else if (msg.includes('禁用')) {
      error.value = locale.isZh ? '账号已被禁用，请联系管理员' : 'Account disabled, contact admin'
    } else {
      error.value = locale.isZh ? '账号或密码错误' : 'Invalid credentials'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-left">
      <div class="login-brand">
        <div class="login-brand__icon">
          <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
            <circle cx="24" cy="24" r="20" stroke="var(--color-primary)" stroke-width="1.5" opacity="0.2" />
            <circle cx="24" cy="24" r="12" stroke="var(--color-primary)" stroke-width="1" opacity="0.35" />
            <circle cx="24" cy="24" r="5" fill="var(--color-primary)" opacity="0.6" />
          </svg>
        </div>
        <div class="login-brand__title">{{ locale.isZh ? '太空记分器' : 'Space Scorekeeper' }}</div>
        <div class="login-brand__sub">{{ locale.t('brand.title') }}</div>
      </div>
      <div class="login-brand__desc">{{ locale.isZh ? '管理航船、编队、航迹与系统状态' : 'Manage vessels, formations, traces and system status' }}</div>

      <div class="login-graphic">
        <svg viewBox="0 0 240 240" fill="none" class="login-orbit">
          <circle cx="120" cy="120" r="100" stroke="var(--color-primary)" stroke-width="1" opacity="0.06" />
          <circle cx="120" cy="120" r="70" stroke="var(--color-cyan)" stroke-width="1" opacity="0.08" />
          <circle cx="120" cy="120" r="40" stroke="var(--color-primary)" stroke-width="1" opacity="0.10" />
          <circle cx="120" cy="120" r="6" fill="var(--color-primary)" opacity="0.3" />
          <circle cx="120" cy="120" r="16" stroke="var(--color-primary)" stroke-width="1" opacity="0.15" />
          <circle cx="190" cy="80" r="3" fill="var(--color-primary)" opacity="0.2" />
          <circle cx="60" cy="150" r="2" fill="var(--color-cyan)" opacity="0.15" />
          <circle cx="170" cy="170" r="2.5" fill="var(--color-purple)" opacity="0.15" />
        </svg>
      </div>
    </div>

    <div class="login-right">
      <div class="login-form">
        <div class="login-form__title">{{ locale.t('login.title') }}</div>

        <div class="login-field">
          <label class="login-label">{{ locale.t('login.username') }}</label>
          <input
            v-model="username"
            class="input-field login-input"
            type="text"
            :placeholder="locale.isZh ? '管理员账号' : 'Admin account'"
            @keyup.enter="handleLogin"
          />
        </div>

        <div class="login-field">
          <label class="login-label">{{ locale.t('login.password') }}</label>
          <div style="position:relative;">
            <input
              v-model="password"
              class="input-field login-input"
              :type="showPassword ? 'text' : 'password'"
              :placeholder="locale.isZh ? '接入密钥' : 'Access key'"
              style="padding-right:36px;"
              @keyup.enter="handleLogin"
            />
            <button
              type="button"
              class="pwd-toggle"
              @click="showPassword = !showPassword"
              :title="showPassword ? (locale.isZh ? '隐藏密码' : 'Hide') : (locale.isZh ? '显示密码' : 'Show')"
            >
              <svg v-if="showPassword" viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" stroke-width="1.5">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" stroke-width="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="error" class="login-error">{{ error }}</div>

        <button
          class="cmd-btn cmd-btn--primary login-btn"
          :disabled="loading"
          @click="handleLogin"
        >
          {{ loading ? locale.t('login.checking') : locale.t('login.submit') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  background: var(--bg-base);
}
.login-left {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 48px;
}
.login-brand { text-align: center; }
.login-brand__icon { margin-bottom: 20px; }
.login-brand__title { font-size: 32px; font-weight: 700; color: var(--text-main); }
.login-brand__sub { font-size: 16px; color: var(--text-secondary); margin-top: 6px; }
.login-brand__desc { font-size: 14px; color: var(--text-muted); margin-top: 16px; }
.login-graphic { margin-top: 48px; }
.login-orbit { width: 240px; height: 240px; }

.login-right {
  width: 480px; display: flex; align-items: center; justify-content: center;
  border-left: 1px solid var(--border-subtle);
  background: var(--bg-panel-strong);
}
.login-form { width: 320px; }
.login-form__title { font-size: 20px; font-weight: 600; margin-bottom: 32px; color: var(--text-main); }
.login-field { margin-bottom: 20px; }
.login-label {
  display: block; font-size: var(--text-sm);
  color: var(--text-muted); margin-bottom: 8px;
}
.login-input { width: 100%; }
.pwd-toggle {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  padding: 4px; display: flex; align-items: center;
  transition: color .15s;
}
.pwd-toggle:hover { color: var(--text-secondary); }
.login-error { font-size: var(--text-sm); color: var(--color-red); margin-bottom: 16px; }
.login-btn { width: 100%; height: 44px; font-size: 14px; margin-top: 8px; border-radius: 14px; }

.login-left { animation: fade-in .5s ease both; }
.login-right { animation: fade-in .5s ease .15s both; }
.login-brand__title { animation: fade-in-up .4s ease .1s both; }
.login-brand__sub { animation: fade-in-up .4s ease .2s both; }
.login-brand__desc { animation: fade-in-up .4s ease .3s both; }
.login-graphic { animation: fade-in .6s ease .4s both; }
.login-orbit { animation: orbit-rotate 120s linear infinite; }

@keyframes orbit-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.login-form__title { animation: fade-in-up .35s ease .25s both; }
.login-field:nth-child(1) { animation: fade-in-up .35s ease .35s both; }
.login-field:nth-child(2) { animation: fade-in-up .35s ease .45s both; }
.login-btn { animation: fade-in-up .35s ease .55s both; }
</style>
