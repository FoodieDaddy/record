<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import { useThemeStore } from '@/stores/theme'
import { useDebounce } from '@/composables/useDebounce'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import HudChart from '@/components/chart/HudChart.vue'
import HudModal from '@/components/feedback/HudModal.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import JsonTreeView from '@/components/data/JsonTreeView.vue'
import { getChartColors } from '@/utils/chart-theme'
import { createErrorTrendOption, createSlowRequestsOption } from '@/utils/chart-factory'

const api = useApi()
const locale = useLocaleStore()

const activeTab = ref<'dashboard' | 'logs'>('dashboard')
const loading = ref(false)

// 看板数据
const dashboardData = ref<any>({
  errorTrend: { dates: [], jsErrors: [], networkErrors: [] },
  slowRequests: [],
  actionDistribution: []
})

// 流水日志列表与筛选数据
const logs = ref<any[]>([])
const total = ref(0)
const page = ref(1)

const filterActionType = ref('')
const filterUserId = ref('')
const filterKeyword = ref('')
const filterStartTime = ref('')
const filterEndTime = ref('')

// 防抖后的筛选值（350ms 延迟后自动触发搜索）
const debouncedUserId = useDebounce(filterUserId, 350)
const debouncedKeyword = useDebounce(filterKeyword, 350)

// 监听防抖值变化，自动触发搜索
watch(debouncedUserId, () => { if (activeTab.value === 'logs') triggerSearch() })
watch(debouncedKeyword, () => { if (activeTab.value === 'logs') triggerSearch() })

const actionTypesPreset = [
  'PAGE_VIEW',
  'JS_ERROR',
  'NETWORK_ERROR',
  'SLOW_REQUEST',
  'FLEET_CREATE',
  'FLEET_JOIN',
  'PULSE_RECORD',
  'FLEET_ARCHIVE',
  'PERSONAL_CALIBRATION',
  'WEBSOCKET_STATUS'
]

// 模态框数据
const showPayloadModal = ref(false)
const selectedPayload = ref('')
const selectedPayloadObj = ref<any>(null)
const selectedRow = ref<any>(null)

const themeStore = useThemeStore()

// ECharts 折线图：近7天系统异常趋势
const errorTrendOption = computed(() => {
  const colors = getChartColors(themeStore.theme)
  return createErrorTrendOption(dashboardData.value.errorTrend, colors, locale.isZh)
})

// ECharts 横向柱状图：接口响应慢耗时排行前10
const slowRequestsOption = computed(() => {
  const colors = getChartColors(themeStore.theme)
  return createSlowRequestsOption(dashboardData.value.slowRequests, colors, locale.isZh)
})

// 原生进度条行为类型占比计算
const totalActionsCount = computed(() => {
  const dist = dashboardData.value.actionDistribution || []
  return dist.reduce((acc: number, cur: any) => acc + cur.count, 0)
})

const behaviorDistribution = computed(() => {
  const dist = dashboardData.value.actionDistribution || []
  const total = totalActionsCount.value || 1
  return dist.map((item: any) => {
    const pct = Math.round((item.count / total) * 1000) / 10
    let color = 'rgba(77, 163, 255, 0.85)' // 默认蓝色
    
    if (item.actionType === 'JS_ERROR') color = 'rgba(255, 90, 90, 0.85)' // 红色
    else if (item.actionType === 'NETWORK_ERROR') color = 'rgba(230, 162, 77, 0.85)' // 橙色
    else if (item.actionType === 'SLOW_REQUEST') color = 'rgba(240, 184, 96, 0.85)' // 黄色
    else if (item.actionType === 'PAGE_VIEW') color = 'rgba(108, 196, 148, 0.85)' // 绿色
    else if (item.actionType.startsWith('FLEET_')) color = 'rgba(139, 138, 240, 0.85)' // 紫色
    
    return {
      ...item,
      percent: pct,
      color
    }
  })
})

// 日志表格列
const columns = computed(() => [
  { key: 'id', label: 'ID', width: '140px', copyable: true },
  { key: 'userId', label: locale.t('users.userId'), width: '130px', copyable: true },
  { key: 'actionType', label: locale.t('behavior.actionType'), width: '140px' },
  { key: 'pagePath', label: locale.t('behavior.pagePath'), width: '200px' },
  { key: 'payload', label: locale.t('behavior.payload') },
  { key: 'ip', label: locale.t('behavior.ip'), width: '110px' },
  { key: 'createdAt', label: locale.t('behavior.createdAt'), width: '160px' },
  { key: 'actions', label: locale.t('common.actions'), width: '100px' }
])

// 分页拉取数据
async function loadLogs() {
  loading.value = true
  try {
    const params: any = {
      page: page.value,
      size: 20
    }
    if (filterActionType.value) params.actionType = filterActionType.value
    if (filterUserId.value) params.userId = filterUserId.value
    if (filterKeyword.value) params.keyword = filterKeyword.value
    if (filterStartTime.value) params.startTime = filterStartTime.value
    if (filterEndTime.value) params.endTime = filterEndTime.value

    const res: any = await api.get('/admin/behavior/page', { params })
    logs.value = res.records || []
    total.value = res.total || 0
  } catch {
  } finally {
    loading.value = false
  }
}

// 拉取仪表盘
async function loadDashboard() {
  try {
    const res: any = await api.get('/admin/behavior/dashboard')
    if (res) {
      dashboardData.value = res
    }
  } catch {}
}

function handleTabChange(tab: 'dashboard' | 'logs') {
  activeTab.value = tab
  if (tab === 'logs') {
    page.value = 1
    loadLogs()
  } else {
    loadDashboard()
  }
}

function resetFilters() {
  filterActionType.value = ''
  filterUserId.value = ''
  filterKeyword.value = ''
  filterStartTime.value = ''
  filterEndTime.value = ''
  page.value = 1
  loadLogs()
}

function triggerSearch() {
  page.value = 1
  loadLogs()
}

function viewPayload(row: any) {
  selectedRow.value = row
  selectedPayloadObj.value = null
  try {
    const parsed = JSON.parse(row.payload)
    selectedPayload.value = JSON.stringify(parsed, null, 2)
    selectedPayloadObj.value = parsed
  } catch (e) {
    selectedPayload.value = row.payload || ''
  }
  showPayloadModal.value = true
}

function closePayloadModal() {
  showPayloadModal.value = false
  selectedPayload.value = ''
  selectedPayloadObj.value = null
  selectedRow.value = null
}

const router = useRouter()
function traceUserDirectives() {
  if (selectedRow.value?.userId) {
    router.push({ path: '/directives/logs', query: { userId: selectedRow.value.userId } })
    closePayloadModal()
  }
}

/**
 * 追溯该请求关联的后端执行 Trace
 * 从 payload JSON 中解析出 requestId，跳转到指令日志页面自动检索
 */
function traceRequestTrace() {
  const requestId = selectedPayloadObj.value?.requestId
  if (requestId) {
    router.push({ path: '/directives/logs', query: { requestId } })
    closePayloadModal()
  }
}

function getActionTypeClass(type: string): string {
  if (type === 'JS_ERROR') return 'badge-danger'
  if (type === 'NETWORK_ERROR') return 'badge-orange'
  if (type === 'SLOW_REQUEST') return 'badge-warning'
  if (type === 'PAGE_VIEW') return 'badge-success'
  if (type.startsWith('FLEET_')) return 'badge-info'
  return 'badge-secondary'
}

onMounted(() => {
  loadDashboard()
})
</script>

<template>
  <div>
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-header__title">{{ locale.t('behavior.title') }}</h1>
        <p class="page-header__subtitle">{{ locale.t('behavior.subtitle') }}</p>
      </div>
      <!-- Tab 切换 -->
      <div class="hud-tabs">
        <button
          class="hud-tab-btn"
          :class="{ active: activeTab === 'dashboard' }"
          @click="handleTabChange('dashboard')"
        >
          {{ locale.t('behavior.tabDashboard') }}
        </button>
        <button
          class="hud-tab-btn"
          :class="{ active: activeTab === 'logs' }"
          @click="handleTabChange('logs')"
        >
          {{ locale.t('behavior.tabLogs') }}
        </button>
      </div>
    </div>

    <!-- 看板 Tab -->
    <div v-if="activeTab === 'dashboard'">
      <div class="stats-grid">
        <!-- 异常折线图 -->
        <div class="chart-panel">
          <div class="chart-panel__header">
            <span class="chart-panel__title">{{ locale.t('behavior.errorTrend') }}</span>
          </div>
          <div class="chart-panel__body">
            <HudChart :option="errorTrendOption" style="height: 300px;" />
          </div>
        </div>
        <!-- 慢响应排行 -->
        <div class="chart-panel">
          <div class="chart-panel__header">
            <span class="chart-panel__title">{{ locale.t('behavior.slowRank') }}</span>
          </div>
          <div class="chart-panel__body">
            <HudChart :option="slowRequestsOption" style="height: 300px;" />
          </div>
        </div>
      </div>

      <!-- 行为分布卡片 (原生 CSS 进度条) -->
      <div class="base-panel" style="margin-top: 16px;">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('behavior.actionDistribution') }}</span>
          <span class="hud-label">{{ locale.t('common.total') }}: {{ totalActionsCount }} {{ locale.t('common.items') }}</span>
        </div>
        <div class="base-panel__body" style="padding: 20px;">
          <div v-if="behaviorDistribution.length === 0" style="padding:20px;text-align:center;">
            <EmptyState :title="locale.t('common.noDataYet')" icon="data" />
          </div>
          <div v-else class="progress-grid">
            <div
              v-for="item in behaviorDistribution"
              :key="item.actionType"
              class="progress-item"
            >
              <div class="progress-item__header">
                <span class="progress-item__name text-mono">{{ item.actionType }}</span>
                <span class="progress-item__value text-mono">
                  {{ item.count }} ({{ item.percent }}%)
                </span>
              </div>
              <div class="progress-bar-bg">
                <div
                  class="progress-bar-fill"
                  :style="{ width: item.percent + '%', backgroundColor: item.color }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 流水日志 Tab -->
    <div v-else class="logs-panel">
      <!-- 搜索过滤面板 -->
      <div class="filter-panel base-panel">
        <div class="base-panel__body filter-body">
          <!-- 筛选：行为类型 -->
          <div class="filter-col">
            <label class="filter-label">{{ locale.t('behavior.actionType') }}</label>
            <select v-model="filterActionType" class="hud-select" @change="triggerSearch">
              <option value="">{{ locale.t('behavior.allTypes') }}</option>
              <option v-for="t in actionTypesPreset" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <!-- 筛选：用户 ID -->
          <div class="filter-col">
            <label class="filter-label">{{ locale.t('behavior.filterUser') }}</label>
            <input
              type="text"
              v-model="filterUserId"
              class="hud-input text-mono"
              placeholder="User ID"
              @keyup.enter="triggerSearch"
            />
          </div>
          <!-- 筛选：关键字 -->
          <div class="filter-col" style="flex: 1.5;">
            <label class="filter-label">{{ locale.t('behavior.filterKeyword') }}</label>
            <input
              type="text"
              v-model="filterKeyword"
              class="hud-input"
              placeholder="e.g. /user/login"
              @keyup.enter="triggerSearch"
            />
          </div>
          <!-- 操作按钮 -->
          <div class="filter-actions">
            <button class="cmd-btn cmd-btn--primary" @click="triggerSearch">
              {{ locale.t('common.search') }}
            </button>
            <button class="cmd-btn" @click="resetFilters">
              {{ locale.t('common.refresh') }}
            </button>
          </div>
        </div>
      </div>

      <!-- 表格模块 -->
      <div class="base-panel" style="margin-top: 16px;">
        <div class="base-panel__body">
          <DataTable :columns="columns" :data="logs" :loading="loading">
            <!-- 行为类型渲染 -->
            <template #actionType="{ row }">
              <span class="hud-badge text-mono" :class="getActionTypeClass(row.actionType)">
                {{ row.actionType }}
              </span>
            </template>
            <!-- 页面路径渲染 -->
            <template #pagePath="{ row }">
              <span class="text-mono cell-path" :title="row.pagePath">{{ row.pagePath || '-' }}</span>
            </template>
            <!-- 负载详情预览 -->
            <template #payload="{ row }">
              <span
                class="text-mono cell-payload-preview"
                :title="row.payload"
                @click="viewPayload(row)"
              >
                {{ row.payload || '-' }}
              </span>
            </template>
            <!-- 发生时间 -->
            <template #createdAt="{ value }">
              <span class="text-mono" style="font-size: 11px; color: var(--text-muted);">
                {{ value ? value.replace('T', ' ').substring(0, 19) : '-' }}
              </span>
            </template>
            <!-- 操作列 -->
            <template #actions="{ row }">
              <button class="action-link" @click="viewPayload(row)">
                {{ locale.t('common.detail') }}
              </button>
            </template>
          </DataTable>
          <DataPagination
            v-model:page="page"
            :total="total"
            :page-size="20"
            @update:page="loadLogs"
          />
        </div>
      </div>
    </div>

    <!-- Payload 详情毛玻璃对话框 -->
    <HudModal v-model:visible="showPayloadModal" :title="locale.t('behavior.payloadDetail')" width="720px">
      <div class="metadata-row">
        <span class="metadata-lbl">{{ locale.t('behavior.actionType') }}:</span>
        <span class="metadata-val hud-badge text-mono" :class="getActionTypeClass(selectedRow?.actionType)">{{ selectedRow?.actionType }}</span>
      </div>
      <div class="metadata-row">
        <span class="metadata-lbl">{{ locale.t('behavior.pagePath') }}:</span>
        <span class="metadata-val text-mono">{{ selectedRow?.pagePath || '-' }}</span>
      </div>
      <div class="metadata-row">
        <span class="metadata-lbl">{{ locale.t('behavior.ip') }}:</span>
        <span class="metadata-val text-mono">{{ selectedRow?.ip || '-' }}</span>
      </div>
      <div class="metadata-row">
        <span class="metadata-lbl">User Agent:</span>
        <span class="metadata-val text-mono" style="font-size:11px; word-break: break-all;">{{ selectedRow?.userAgent || '-' }}</span>
      </div>
      <div v-if="selectedRow?.userId" class="metadata-row" style="margin-top: 8px;">
        <span class="metadata-lbl">用户溯源:</span>
        <button class="cmd-btn cmd-btn--primary" @click="traceUserDirectives" style="height: 28px; font-size: 11px;">
          追溯此用户指令日志
        </button>
      </div>
      <div v-if="selectedPayloadObj?.requestId" class="metadata-row" style="margin-top: 8px;">
        <span class="metadata-lbl">Request ID:</span>
        <span class="metadata-val text-mono" style="color: var(--color-cyan); font-size: 11px;">{{ selectedPayloadObj.requestId }}</span>
        <button class="cmd-btn cmd-btn--primary" @click="traceRequestTrace" style="height: 28px; font-size: 11px;">
          追溯该请求关联的后端执行 Trace
        </button>
      </div>

      <div class="payload-pre-wrap">
        <!-- JSON 树形折叠渲染 -->
        <JsonTreeView v-if="selectedPayloadObj" :data="selectedPayloadObj" />
        <!-- 非 JSON 格式降级为纯文本展示 -->
        <pre v-else class="text-mono">{{ selectedPayload || locale.t('behavior.noPayload') }}</pre>
      </div>
    </HudModal>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
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

/* Tab 切换样式 */
.hud-tabs {
  display: flex;
  background: var(--bg-panel-strong);
  border: 1px solid rgba(120, 140, 170, 0.10);
  border-radius: 10px;
  padding: 2px;
}
.hud-tab-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all .2s ease;
}
.hud-tab-btn:hover {
  color: var(--text-main);
}
.hud-tab-btn.active {
  background: var(--btn-primary-bg);
  color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(31, 52, 88, 0.05);
}

/* 看板两列布局 */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.chart-panel {
  background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.58));
  border: 1px solid rgba(255,255,255,0.38);
  border-radius: 24px;
  box-shadow: 0 18px 42px rgba(31,52,88,0.09), inset 0 1px 0 rgba(255,255,255,0.78);
  overflow: hidden;
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}
.chart-panel__header {
  height: 52px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.30);
  background: linear-gradient(180deg, rgba(255,255,255,0.46), rgba(255,255,255,0.22));
}
.chart-panel__title {
  font-size: 14px;
  font-weight: 700;
  color: #2A3442;
}
.chart-panel__body {
  padding: 8px;
}

/* 原生 CSS 进度条网格 */
.progress-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 24px;
}
.progress-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.progress-item__header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}
.progress-item__name {
  color: var(--text-secondary);
  font-weight: 500;
}
.progress-item__value {
  color: var(--text-main);
  font-weight: 600;
}
.progress-bar-bg {
  width: 100%;
  height: 6px;
  background: rgba(120, 140, 170, 0.08);
  border-radius: 3px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width .8s cubic-bezier(0.1, 0.8, 0.2, 1);
}

/* 过滤面板样式 */
.filter-body {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  padding: 16px;
}
.filter-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.filter-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}
.hud-select, .hud-input {
  width: 100%;
  height: 36px;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(130, 150, 180, 0.18);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--text-main);
  outline: none;
  transition: border-color .15s, background-color .15s;
}
.hud-select:focus, .hud-input:focus {
  border-color: var(--color-cyan);
  background: rgba(255, 255, 255, 0.65);
}
.filter-actions {
  display: flex;
  gap: 8px;
  height: 36px;
}

/* 表格定制渲染 */
.cell-path {
  font-size: 11px;
  color: var(--text-secondary);
}
.cell-payload-preview {
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  max-width: 260px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  transition: color .15s;
}
.cell-payload-preview:hover {
  color: var(--color-cyan);
}
.action-link {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: opacity .15s;
}
.action-link:hover {
  opacity: 0.8;
}

/* 勋章微缩胶囊 (Badge) */
.hud-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.2px;
}
.badge-danger { background: rgba(255, 90, 90, 0.1); color: #FF5A5A; border: 1px solid rgba(255, 90, 90, 0.15); }
.badge-orange { background: rgba(230, 162, 77, 0.1); color: #E6A24D; border: 1px solid rgba(230, 162, 77, 0.15); }
.badge-warning { background: rgba(240, 184, 96, 0.1); color: #F0B860; border: 1px solid rgba(240, 184, 96, 0.15); }
.badge-success { background: rgba(108, 196, 148, 0.1); color: #6CC494; border: 1px solid rgba(108, 196, 148, 0.15); }
.badge-info { background: rgba(139, 138, 240, 0.1); color: #8B8AF0; border: 1px solid rgba(139, 138, 240, 0.15); }
.badge-secondary { background: rgba(120, 140, 170, 0.1); color: var(--text-muted); border: 1px solid rgba(120, 140, 170, 0.15); }

/* 毛玻璃模态对话框 */
.hud-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.hud-modal {
  width: 100%;
  max-width: 600px;
  background: linear-gradient(180deg, rgba(255,255,255,0.76), rgba(255,255,255,0.60));
  border: 1px solid rgba(255,255,255,0.42);
  border-radius: 24px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.15), inset 0 1px 0 rgba(255,255,255,0.8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.hud-modal__header {
  height: 52px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255,255,255,0.3);
  background: linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0.15));
}
.hud-modal__title {
  font-size: 14px;
  font-weight: 700;
  color: #1E293B;
}
.hud-modal__close {
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--text-muted);
  cursor: pointer;
}
.hud-modal__body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.metadata-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}
.metadata-lbl {
  width: 90px;
  color: var(--text-muted);
  font-weight: 600;
  flex-shrink: 0;
}
.metadata-val {
  color: var(--text-main);
  font-weight: 500;
}
.payload-pre-wrap {
  margin-top: 8px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  max-height: 280px;
  overflow-y: auto;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3);
}
.payload-pre-wrap pre {
  margin: 0;
  font-size: 11px;
  color: #A5D6FF;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}
.hud-modal__footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255,255,255,0.25);
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: 1fr; }
  .progress-grid { grid-template-columns: 1fr; }
}
</style>
