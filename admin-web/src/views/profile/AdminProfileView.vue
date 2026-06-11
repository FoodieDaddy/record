<script setup lang="ts">
/**
 * 管理员个人资料与安全设置页面
 * 功能：修改密码、查看账户信息
 */
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toast'

const api = useApi()
const auth = useAuthStore()
const locale = useLocaleStore()
const toast = useToastStore()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const passwordVisible = ref(false)

async function changePassword() {
  if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
    toast.warn(locale.t('profile.fillAllFields'))
    return
  }
  if (newPassword.value.length < 8) {
    toast.warn(locale.t('profile.passwordTooShort'))
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.warn(locale.t('profile.passwordMismatch'))
    return
  }

  submitting.value = true
  try {
    await api.put('/admin/password', {
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    })
    toast.success(locale.t('profile.passwordChanged'))
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err: any) {
    toast.error(err?.message || locale.t('profile.changeFailed'))
  } finally {
    submitting.value = false
  }
}

function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: locale.t('role.superAdmin'),
    OPERATOR: locale.t('role.operator'),
    VIEWER: locale.t('role.viewer'),
  }
  return map[role] || role
}
</script>

<template>
  <div>
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-header__title">{{ locale.t('profile.title') }}</h1>
        <p class="page-header__subtitle">{{ locale.t('profile.subtitle') }}</p>
      </div>
    </div>

    <div class="profile-grid">
      <!-- 账户信息卡片 -->
      <div class="base-panel profile-card">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('profile.accountInfo') }}</span>
        </div>
        <div class="base-panel__body">
          <div class="info-row">
            <span class="info-label">{{ locale.t('admins.username') }}</span>
            <span class="info-value text-mono">{{ auth.username }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">{{ locale.t('admins.role') }}</span>
            <span class="info-value hud-badge" :class="auth.role === 'SUPER_ADMIN' ? 'badge-info' : auth.role === 'OPERATOR' ? 'badge-success' : 'badge-secondary'">
              {{ getRoleLabel(auth.role) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 修改密码卡片 -->
      <div class="base-panel profile-card">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('profile.changePassword') }}</span>
        </div>
        <div class="base-panel__body">
          <form class="password-form" @submit.prevent="changePassword">
            <div class="form-group">
              <label class="form-label">{{ locale.t('profile.oldPassword') }}</label>
              <input
                v-model="oldPassword"
                :type="passwordVisible ? 'text' : 'password'"
                class="input-field"
                :placeholder="locale.t('profile.oldPasswordPlaceholder')"
                autocomplete="current-password"
              />
            </div>
            <div class="form-group">
              <label class="form-label">{{ locale.t('profile.newPassword') }}</label>
              <input
                v-model="newPassword"
                :type="passwordVisible ? 'text' : 'password'"
                class="input-field"
                :placeholder="locale.t('profile.newPasswordPlaceholder')"
                autocomplete="new-password"
              />
            </div>
            <div class="form-group">
              <label class="form-label">{{ locale.t('profile.confirmPassword') }}</label>
              <input
                v-model="confirmPassword"
                :type="passwordVisible ? 'text' : 'password'"
                class="input-field"
                :placeholder="locale.t('profile.confirmPasswordPlaceholder')"
                autocomplete="new-password"
              />
            </div>
            <div class="form-actions">
              <button class="cmd-btn cmd-btn--primary" type="submit" :disabled="submitting">
                {{ submitting ? locale.t('common.loading') : locale.t('profile.savePassword') }}
              </button>
              <button type="button" class="cmd-btn" @click="passwordVisible = !passwordVisible">
                {{ passwordVisible ? locale.t('profile.hidePassword') : locale.t('profile.showPassword') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- 安全提示卡片 -->
      <div class="base-panel profile-card">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('profile.securityTips') }}</span>
        </div>
        <div class="base-panel__body">
          <ul class="tips-list">
            <li>{{ locale.t('profile.tip1') }}</li>
            <li>{{ locale.t('profile.tip2') }}</li>
            <li>{{ locale.t('profile.tip3') }}</li>
            <li>{{ locale.t('profile.tip4') }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;
}
.page-header__title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-main);
}
.page-header__subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: 4px;
}
.profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.profile-card {
  height: fit-content;
}
.info-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  gap: 16px;
  border-bottom: 1px solid var(--table-row-border);
}
.info-label {
  width: 80px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  flex-shrink: 0;
}
.info-value {
  font-size: 13px;
  color: var(--text-main);
}
.password-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tips-list li {
  font-size: 12px;
  color: var(--text-secondary);
  padding-left: 20px;
  position: relative;
  line-height: 1.6;
}
.tips-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-cyan);
  opacity: 0.6;
}
</style>
