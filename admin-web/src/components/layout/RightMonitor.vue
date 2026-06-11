<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAppStore } from '@/stores/app'
import { useLocaleStore } from '@/stores/locale'

const api = useApi()
const app = useAppStore()
const locale = useLocaleStore()
const services = ref<any[]>([])
const events = ref<any[]>([])
const lastSyncTime = ref('')
let timer: number

function formatTime() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  lastSyncTime.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function loadData() {
  try {
    const [health, eventData] = await Promise.all([
      api.get('/admin/system/health'),
      api.get('/admin/dashboard/events'),
    ])
    if (Array.isArray(health)) services.value = health.slice(0, 8)
    if (Array.isArray(eventData)) events.value = eventData.slice(0, 8)
    formatTime()
  } catch {}
}

function manualRefresh() {
  loadData()
}

onMounted(() => {
  loadData()
  timer = window.setInterval(loadData, 30000)
})
onUnmounted(() => window.clearInterval(timer))
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="app.rightPanelOpen" class="drawer-overlay" @click.self="app.toggleRightPanel()">
        <Transition name="drawer-slide">
          <aside v-if="app.rightPanelOpen" class="monitor-drawer">
            <div class="drawer-header">
              <span class="drawer-header__title">{{ locale.t('common.monitor') }}</span>
              <button class="cmd-btn cmd-btn--ghost" style="height:26px;padding:0 8px;font-size:11px;" @click="app.toggleRightPanel()">
                {{ locale.t('common.collapse') }}
              </button>
            </div>

            <div class="drawer-section">
              <div class="drawer-section__title">{{ locale.t('drawer.systemHealth') }}</div>
              <div v-for="s in services" :key="s.name" class="drawer-row">
                <span class="drawer-dot" :class="`dot--${s.status}`" />
                <span class="drawer-name">{{ s.name }}</span>
                <span class="drawer-latency text-mono">{{ s.latency }}</span>
              </div>
              <div v-if="services.length === 0" class="drawer-empty">{{ locale.t('common.loading') }}</div>
            </div>

            <div class="drawer-section">
              <div class="drawer-section__title">{{ locale.t('drawer.liveEvents') }}</div>
              <div v-for="(e, i) in events" :key="i" class="event-row">
                <span class="event-time text-mono">{{ e.time }}</span>
                <span class="event-dot" :class="`dot--${e.color}`" />
                <span class="event-desc">{{ e.desc }}</span>
              </div>
              <div v-if="events.length === 0" class="drawer-empty">{{ locale.t('dashboard.noEvents') }}</div>
            </div>

            <div class="drawer-footer">
              <div class="drawer-footer__sync">
                <span class="drawer-footer__label">{{ locale.t('drawer.lastSyncTime') }}</span>
                <span class="drawer-footer__time text-mono">{{ lastSyncTime || '-' }}</span>
              </div>
              <button class="cmd-btn cmd-btn--secondary" style="height:28px;font-size:11px;padding:0 12px;" @click="manualRefresh">
                {{ locale.t('drawer.manualRefresh') }}
              </button>
            </div>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: var(--drawer-overlay);
  backdrop-filter: blur(4px);
  z-index: 500;
}
.monitor-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 340px;
  background: rgba(255, 255, 255, 0.82);
  border-left: 1px solid rgba(255, 255, 255, 0.30);
  border-radius: 24px 0 0 24px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  z-index: 501;
  box-shadow: -8px 0 32px rgba(31, 52, 88, 0.08);
  backdrop-filter: blur(24px);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}
.drawer-header__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.drawer-section {
  padding: 16px 20px;
}
.drawer-section + .drawer-section {
  border-top: 1px solid var(--monitor-section-border);
}
.drawer-section__title {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.2px;
  margin-bottom: 12px;
}
.drawer-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 12px;
}
.drawer-dot, .event-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--ok, .dot--green { background: var(--color-green); }
.dot--warn { background: var(--color-orange); }
.dot--error { background: var(--color-red); }
.dot--blue { background: var(--color-primary); }
.dot--cyan { background: var(--color-cyan); }
.drawer-name { flex: 1; color: var(--text-secondary); font-size: 12px; }
.drawer-latency { color: var(--text-muted); font-size: 11px; }
.drawer-empty { font-size: 12px; color: var(--text-muted); padding: 12px 0; }

.event-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 11px;
}
.event-time { color: var(--text-muted); min-width: 40px; font-size: 10px; }
.event-desc { color: var(--text-secondary); font-size: 11px; }

.drawer-footer {
  margin-top: auto;
  padding: 16px 20px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.drawer-footer__sync {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.drawer-footer__label {
  font-size: 10px;
  color: var(--text-disabled);
}
.drawer-footer__time {
  font-size: 12px;
  color: var(--text-muted);
}

/* 动画 */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity .2s ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}
.drawer-slide-enter-active {
  transition: transform .25s ease;
}
.drawer-slide-leave-active {
  transition: transform .2s ease;
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
