<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import EmptyState from '@/components/feedback/EmptyState.vue'

const api = useApi()
const locale = useLocaleStore()
const services = ref<any[]>([])
const loading = ref(true)
const sentinelInfo = ref<any>(null)
const lastCheck = ref('')
let timer: number

const defaultServices = [
  { name: 'API 服务', status: 'ok', latency: '-', detail: '运行中' },
  { name: 'MySQL', status: 'ok', latency: '-', detail: '连接正常' },
  { name: 'Redis', status: 'ok', latency: '-', detail: '连接正常' },
  { name: 'WebSocket', status: 'ok', latency: '-', detail: '运行中' },
  { name: 'CloudBase 存储', status: 'ok', latency: '-', detail: '可用' },
  { name: 'TTS 主引擎', status: 'ok', latency: '-', detail: 'Edge-TTS' },
  { name: 'TTS 副引擎', status: 'ok', latency: '-', detail: 'MiMo' },
  { name: '导航主引擎', status: 'ok', latency: '-', detail: 'LLM' },
]

function mapServiceName(name: string): string {
  const map: Record<string, string> = {
    'API 服务': locale.t('system.apiService'),
    'MySQL': locale.t('system.database'),
    'Redis': locale.t('system.cache'),
    'WebSocket': locale.t('system.realtime'),
    'CloudBase 存储': locale.t('system.cloudStorage'),
    'TTS 主引擎': locale.t('system.voiceMain'),
    'TTS 副引擎': locale.t('system.voiceAlt'),
    'Edge-TTS': locale.t('system.voiceMain'),
    'MiMo': locale.t('system.voiceAlt'),
    'LLM': locale.t('system.navMain'),
    '导航主引擎': locale.t('system.navMain'),
  }
  return map[name] || name
}

function mapServiceDetail(detail: string): string {
  const map: Record<string, string> = {
    'Edge-TTS': locale.t('system.voiceMain'),
    'MiMo': locale.t('system.voiceAlt'),
    'LLM': locale.t('system.navMain'),
  }
  return map[detail] || detail
}

const servicesToShow = computed(() => {
  const list = services.value.length ? services.value : defaultServices
  return list.map(s => ({
    ...s,
    displayName: mapServiceName(s.name),
    displayDetail: mapServiceDetail(s.detail || ''),
  }))
})

function updateTime() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  lastCheck.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function loadHealth() {
  try {
    const data: any = await api.get('/admin/system/health')
    if (Array.isArray(data)) services.value = data
    updateTime()
  } catch {} finally { loading.value = false }
}

onMounted(() => {
  loadHealth()
  timer = window.setInterval(loadHealth, 30000)
  api.get('/admin/system/sentinel').then((data: any) => { sentinelInfo.value = data }).catch(() => {})
})

onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div>
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-header__title">{{ locale.t('nav.system') }}</h1>
        <p class="page-header__subtitle">{{ locale.t('system.healthMatrix') }}</p>
      </div>
      <div class="page-header__right">
        <span v-if="lastCheck" class="page-header__sync text-mono">{{ locale.t('system.lastCheck') }} {{ lastCheck }}</span>
      </div>
    </div>

    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header">
        <span class="base-panel__title">{{ locale.t('system.healthMatrix') }}</span>
        <span class="hud-label">{{ locale.t('system.healthMatrix') }}</span>
      </div>
      <div class="base-panel__body">
        <div class="health-grid">
          <div v-for="s in servicesToShow" :key="s.name" class="health-card">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="width:8px;height:8px;border-radius:50%;" :style="{ background: s.status === 'ok' ? 'var(--color-green)' : s.status === 'warn' ? 'var(--color-orange)' : 'var(--color-red)' }" />
              <span style="font-size:13px;font-weight:500;">{{ s.displayName }}</span>
            </div>
            <div class="text-mono" style="font-size:20px;color:var(--text-main);">{{ s.latency || '-' }}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">{{ s.displayDetail }}</div>
          </div>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="base-panel">
        <div class="base-panel__header"><span class="base-panel__title">{{ locale.t('system.slowRequests') }}</span></div>
        <div class="base-panel__body empty-panel">
          <EmptyState :title="locale.t('common.noDataYet')" :description="locale.t('common.afterConnect')" icon="data" />
        </div>
      </div>
      <div class="base-panel">
        <div class="base-panel__header"><span class="base-panel__title">{{ locale.t('system.errorRank') }}</span></div>
        <div class="base-panel__body empty-panel">
          <EmptyState :title="locale.t('common.noDataYet')" :description="locale.t('common.afterConnect')" icon="data" />
        </div>
      </div>
    </div>
    <div class="base-panel" style="margin-top:16px;">
      <div class="base-panel__header">
        <span class="base-panel__title">{{ locale.t('system.sentinel') }}</span>
      </div>
      <div class="base-panel__body" style="display:flex;align-items:center;gap:16px;">
        <div style="flex:1;">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">{{ locale.t('system.sentinel') }}</div>
          <div class="text-mono" style="font-size:13px;color:var(--text-secondary);">{{ sentinelInfo?.dashboardUrl || 'http://localhost:18858' }}</div>
        </div>
        <a
          :href="sentinelInfo?.dashboardUrl || 'http://localhost:18858'"
          target="_blank"
          rel="noopener noreferrer"
          class="cmd-btn cmd-btn--primary"
          style="text-decoration:none;height:32px;font-size:12px;"
        >
          {{ locale.t('system.openConsole') }}
        </a>
      </div>
    </div>
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
.page-header__right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.page-header__sync {
  font-size: var(--text-xs);
  color: var(--text-disabled);
}
.health-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.health-card {
  padding: 18px;
  background: var(--bg-panel-strong);
  border: 1px solid rgba(120, 140, 170, 0.10);
  border-radius: 16px;
  box-shadow: 0 6px 18px rgba(31, 52, 88, 0.05);
  transition: transform .18s ease, box-shadow .18s ease;
}
.health-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(31, 52, 88, 0.08);
}
.empty-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}
@media (max-width: 1440px) {
  .health-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 1024px) {
  .health-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
