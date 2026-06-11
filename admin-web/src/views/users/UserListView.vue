<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useLocaleStore } from '@/stores/locale'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import ConfirmDangerModal from '@/components/modal/ConfirmDangerModal.vue'
import { exportToCSV } from '@/utils/export-csv'

const router = useRouter()
const api = useApi()
const toast = useToastStore()
const locale = useLocaleStore()

const loading = ref(false)
const users = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const selectedIds = ref<(string | number)[]>([])
const showBatchConfirm = ref(false)
const batchAction = ref<'enable' | 'disable' | 'delete'>('disable')
const statusFilter = ref<'all' | 'active' | 'disabled'>('all')

const columns = computed(() => [
  { key: 'id', label: locale.t('users.userId'), width: '140px', copyable: true },
  { key: 'nickname', label: locale.t('users.callsign') },
  { key: 'identityLevel', label: locale.t('user.identityLevel'), width: '100px' },
  { key: 'experience', label: locale.t('user.experience'), width: '100px' },
  { key: 'status', label: locale.t('common.status'), width: '80px' },
  { key: 'createdAt', label: locale.t('user.registered'), width: '140px' },
  { key: 'actions', label: locale.t('common.actions'), width: '160px' },
])

const hasSelection = computed(() => selectedIds.value.length > 0)
const selectionCount = computed(() => selectedIds.value.length)

const summaryStats = computed(() => ({
  total: total.value,
  active: users.value.filter(u => u.status === 1).length,
  disabled: users.value.filter(u => u.status === 0).length,
  todayNew: 0,
}))

async function loadUsers() {
  loading.value = true
  selectedIds.value = []
  try {
    const params: any = { page: page.value, size: 20, keyword: search.value }
    if (statusFilter.value === 'active') params.status = 1
    if (statusFilter.value === 'disabled') params.status = 0
    const data: any = await api.get('/admin/users', { params })
    users.value = data.records || []
    total.value = data.total || 0
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function toggleUserStatus(user: any) {
  const newStatus = user.status === 1 ? 0 : 1
  try {
    await api.put(`/admin/users/${user.id || user.userId}/status`, null, { params: { status: newStatus } })
    toast.success(newStatus === 1 ? locale.t('admins.enabled') : locale.t('admins.disabled'))
    loadUsers()
  } catch {}
}

function openBatch(action: 'enable' | 'disable' | 'delete') {
  batchAction.value = action
  showBatchConfirm.value = true
}

async function executeBatch() {
  try {
    if (batchAction.value === 'delete') {
      await api.delete('/admin/users/batch', { data: selectedIds.value })
    } else {
      const status = batchAction.value === 'enable' ? 1 : 0
      await api.put('/admin/users/batch-status', selectedIds.value, { params: { status } })
    }
    showBatchConfirm.value = false
    loadUsers()
  } catch {}
}

function setFilter(f: 'all' | 'active' | 'disabled') {
  statusFilter.value = f
  page.value = 1
  loadUsers()
}

onMounted(() => { loadUsers() })
</script>

<template>
  <div>
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-header__title">{{ locale.t('users.title') }}</h1>
        <p class="page-header__subtitle">{{ locale.t('users.subtitle') }}</p>
      </div>
    </div>

    <!-- 摘要指标 -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(47,128,237,0.08);color:#2F80ED;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono">{{ summaryStats.total }}</span>
          <span class="summary-card__label">{{ locale.t('users.total') }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(90,183,132,0.08);color:#5AB784;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono" style="color:var(--color-green);">{{ summaryStats.active }}</span>
          <span class="summary-card__label">{{ locale.t('users.active') }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(226,109,109,0.08);color:#E26D6D;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono" style="color:var(--color-red);">{{ summaryStats.disabled }}</span>
          <span class="summary-card__label">{{ locale.t('users.disabledUsers') }}</span>
        </div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="base-panel__title">{{ locale.t('users.title') }}</span>
          <span class="hud-label">{{ locale.t('users.subtitle') }}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span v-if="hasSelection" style="font-size:12px;color:var(--color-cyan);">
            {{ locale.t('common.selected') }} {{ selectionCount }}
          </span>
        </div>
      </div>

      <!-- 筛选与批量操作栏 -->
      <div class="toolbar">
        <div style="display:flex;gap:8px;align-items:center;">
          <input
            v-model="search"
            class="input-field"
            style="width:260px;"
            :placeholder="locale.t('users.search')"
            @keyup.enter="loadUsers"
          />
          <CommandButton variant="secondary" @click="loadUsers">{{ locale.t('common.search') }}</CommandButton>
          <CommandButton variant="ghost" style="height:32px;font-size:11px;" @click="loadUsers" :title="locale.t('common.refresh')">↻</CommandButton>
          <CommandButton variant="ghost" style="height:32px;font-size:11px;" @click="exportToCSV('users', columns, users)">CSV</CommandButton>
          <div class="filter-group">
            <button class="filter-btn" :class="{ active: statusFilter === 'all' }" @click="setFilter('all')">{{ locale.t('users.filterAll') }}</button>
            <button class="filter-btn" :class="{ active: statusFilter === 'active' }" @click="setFilter('active')">{{ locale.t('users.filterActive') }}</button>
            <button class="filter-btn" :class="{ active: statusFilter === 'disabled' }" @click="setFilter('disabled')">{{ locale.t('users.filterDisabled') }}</button>
          </div>
        </div>

        <div v-if="hasSelection" class="batch-actions">
          <CommandButton variant="secondary" style="height:30px;font-size:12px;" @click="openBatch('enable')">
            {{ locale.t('batch.enable') }}
          </CommandButton>
          <CommandButton variant="danger" style="height:30px;font-size:12px;" @click="openBatch('disable')">
            {{ locale.t('batch.disable') }}
          </CommandButton>
          <CommandButton variant="danger" style="height:30px;font-size:12px;" @click="openBatch('delete')">
            {{ locale.t('batch.delete') }}
          </CommandButton>
        </div>
      </div>

      <div class="base-panel__body" style="padding-top:0;">
        <DataTable
          :columns="columns"
          :data="users"
          :loading="loading"
          :selectable="true"
          v-model:selectedIds="selectedIds"
        >
          <template #status="{ row }">
            <StatusPill
              :status="row.status === 1 ? 'ok' : row.status === 0 ? 'offline' : 'error'"
              :label="row.status === 1 ? locale.t('common.normal') : locale.t('common.disabled')"
            />
          </template>
          <template #createdAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
          <template #actions="{ row }">
            <div style="display:flex;gap:6px;">
              <CommandButton variant="ghost" style="height:26px;font-size:11px;padding:0 10px;" @click="router.push(`/users/${row.id || row.userId}`)">
                {{ locale.t('common.viewDetail') }}
              </CommandButton>
              <CommandButton
                :variant="row.status === 1 ? 'danger' : 'secondary'"
                style="height:26px;font-size:11px;padding:0 10px;"
                @click="toggleUserStatus(row)"
              >
                {{ row.status === 1 ? locale.t('common.disable') : locale.t('common.enable') }}
              </CommandButton>
            </div>
          </template>
        </DataTable>

        <DataPagination v-model:page="page" :total="total" :page-size="20" @update:page="loadUsers" />
        <div v-if="!loading && users.length > 0 && users.length <= 5" class="sparse-hint">
          {{ locale.isZh ? '当前仅显示已接入后台的航船，可通过小程序端接入更多用户。' : 'Showing vessels that have connected to the backend. More users can be onboarded via the mini program.' }}
        </div>
      </div>
    </div>

    <!-- 批量操作确认弹窗 -->
    <ConfirmDangerModal
      :visible="showBatchConfirm"
      :title="batchAction === 'delete' ? locale.t('batch.confirmDelete') : batchAction === 'enable' ? locale.t('batch.confirmEnable') : locale.t('batch.confirmDisable')"
      :description="`${locale.t('common.confirm')} ${selectionCount} ?`"
      :impact="batchAction === 'delete' ? locale.t('batch.irreversible') : undefined"
      :confirm-text="locale.t('common.confirm')"
      :require-confirm-word="batchAction === 'delete'"
      confirm-word="DELETE"
      @confirm="executeBatch"
      @cancel="showBatchConfirm = false"
    />
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 16px;
}
.page-header__title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.3;
}
.page-header__subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: 4px;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
.summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  height: 92px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 255, 0.92));
  border: 1px solid rgba(130, 150, 180, 0.16);
  border-radius: 18px;
  box-shadow: 0 12px 28px rgba(31, 52, 88, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.85);
  transition: transform .2s ease, box-shadow .2s ease;
}
.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px rgba(31, 52, 88, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.85);
}
.summary-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, #E8F2FF, #DDF8FA);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.summary-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.summary-card__value {
  font-size: 28px;
  font-weight: 800;
  color: #111827;
  line-height: 1.1;
}
.summary-card__label {
  font-size: 12px;
  font-weight: 600;
  color: #536176;
}

.sparse-hint {
  padding: 12px 16px;
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  border-top: 1px solid var(--border-subtle);
  margin-top: 8px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--table-row-border);
}
.batch-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  animation: fade-in .2s ease;
}

.filter-group {
  display: flex;
  gap: 2px;
  margin-left: 8px;
}
.filter-btn {
  padding: 5px 12px;
  font-size: 11px;
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color .12s, border-color .12s, color .12s;
}
.filter-btn.active {
  background: var(--btn-primary-bg);
  border-color: var(--btn-primary-border);
  color: var(--color-primary);
}
.filter-btn:hover:not(.active) {
  background: var(--btn-ghost-hover-bg);
}
</style>
