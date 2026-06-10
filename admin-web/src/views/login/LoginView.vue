<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useToastStore } from '@/stores/toast'

const router = useRouter()
const { login } = useAuth()
const toast = useToastStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = '请输入账号和密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await login(username.value, password.value)
    toast.success('权限接入完成')
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.message || '接入失败，请检查凭证'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-left">
      <div class="login-brand">
        <div class="login-brand__title">太空记分器</div>
        <div class="login-brand__sub">· 基地总控台</div>
      </div>
      <div class="login-brand__en">SPACE SCOREKEEPER · COMMAND BASE</div>
      <div class="login-brand__desc">管理航船、编队、航迹与系统状态</div>

      <div class="login-graphic">
        <svg viewBox="0 0 240 240" fill="none" class="login-orbit">
          <circle cx="120" cy="120" r="100" stroke="rgba(10,132,255,0.08)" stroke-width="1" />
          <circle cx="120" cy="120" r="70" stroke="rgba(0,200,255,0.10)" stroke-width="1" />
          <circle cx="120" cy="120" r="40" stroke="rgba(10,132,255,0.12)" stroke-width="1" />
          <circle cx="120" cy="120" r="6" fill="rgba(0,200,255,0.5)" />
          <circle cx="120" cy="120" r="16" stroke="rgba(0,200,255,0.25)" stroke-width="1" />
          <circle cx="190" cy="80" r="3" fill="rgba(10,132,255,0.4)" />
          <circle cx="60" cy="150" r="2" fill="rgba(0,200,255,0.3)" />
          <circle cx="170" cy="170" r="2.5" fill="rgba(94,92,230,0.3)" />
        </svg>
      </div>
    </div>

    <div class="login-right">
      <div class="login-form">
        <div class="login-form__title">管理员接入</div>

        <div class="login-field">
          <label class="login-label">账号</label>
          <input
            v-model="username"
            class="input-field login-input"
            type="text"
            placeholder="管理员账号"
            @keyup.enter="handleLogin"
          />
        </div>

        <div class="login-field">
          <label class="login-label">密码</label>
          <input
            v-model="password"
            class="input-field login-input"
            type="password"
            placeholder="接入密钥"
            @keyup.enter="handleLogin"
          />
        </div>

        <div v-if="error" class="login-error">{{ error }}</div>

        <button
          class="cmd-btn cmd-btn--primary login-btn"
          :disabled="loading"
          @click="handleLogin"
        >
          {{ loading ? '正在校验基地权限...' : '接入基地总控台' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page { min-height: 100vh; display: flex; }
.login-left {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 48px;
}
.login-brand { text-align: center; }
.login-brand__title { font-size: 32px; font-weight: 700; }
.login-brand__sub { font-size: 18px; color: var(--text-secondary); margin-top: 4px; }
.login-brand__en {
  font-family: var(--font-mono); font-size: 11px;
  color: var(--text-disabled); letter-spacing: 2px; margin-top: 12px;
}
.login-brand__desc { font-size: 14px; color: var(--text-muted); margin-top: 16px; }
.login-graphic { margin-top: 48px; }
.login-orbit { width: 240px; height: 240px; }

.login-right {
  width: 480px; display: flex; align-items: center; justify-content: center;
  border-left: 1px solid var(--border-subtle); background: rgba(4,8,16,0.4);
}
.login-form { width: 320px; }
.login-form__title { font-size: 20px; font-weight: 600; margin-bottom: 32px; }
.login-field { margin-bottom: 20px; }
.login-label {
  display: block; font-size: var(--text-sm);
  color: var(--text-muted); margin-bottom: 8px;
}
.login-input { width: 100%; }
.login-error { font-size: var(--text-sm); color: var(--color-red); margin-bottom: 16px; }
.login-btn { width: 100%; height: 44px; font-size: 14px; margin-top: 8px; }

.login-left {
  animation: fade-in .6s ease both;
}
.login-right {
  animation: fade-in .6s ease .2s both;
}
.login-brand__title {
  animation: fade-in-up .5s ease .1s both;
}
.login-brand__sub {
  animation: fade-in-up .5s ease .2s both;
}
.login-brand__en {
  animation: fade-in-up .5s ease .3s both;
}
.login-brand__desc {
  animation: fade-in-up .5s ease .4s both;
}
.login-graphic {
  animation: fade-in .8s ease .5s both;
}
.login-orbit {
  animation: orbit-rotate 120s linear infinite;
}

@keyframes orbit-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.login-form__title {
  animation: fade-in-up .4s ease .3s both;
}
.login-field:nth-child(1) {
  animation: fade-in-up .4s ease .4s both;
}
.login-field:nth-child(2) {
  animation: fade-in-up .4s ease .5s both;
}
.login-btn {
  animation: fade-in-up .4s ease .6s both;
}
</style>
