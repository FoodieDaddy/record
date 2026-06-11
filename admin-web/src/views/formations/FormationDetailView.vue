<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import ConfirmDangerModal from '@/components/modal/ConfirmDangerModal.vue'
import SkeletonLoader from '@/components/feedback/SkeletonLoader.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const api = useApi()
const locale = useLocaleStore()
const formation = ref<any>(null)
const loading = ref(true)
const dangerExpanded = ref(false)
const dangerModal = ref({ visible: false, title: '', description: '', impact: '', action: '', confirmText: '' })

onMounted(async () => {
  try {
    const data: any = await api.get(`/admin/formations/${route.params.id}`)
    // Handle both response formats
    if (data.formation) {
      formation.value = { ...data.formation, members: data.members || [] }
    } else {
      formation.value = data
    }
  } finally { loading.value = false }
})

function openDanger(action: string) {
  const map: Record<string, any> = {
    seal: {
      title: locale.isZh ? '强制封存航程' : 'Force Seal Voyage',
      description: locale.isZh ? '将正常结束当前任务并写入航迹档案。所有运行期脉冲数据将被归档。' : 'Will end current mission and write to trace archive. All runtime pulse data will be archived.',
      impact: locale.isZh ? '编队中所有成员的当前脉冲将被封存为最终读数。' : 'All members\' current pulses will be sealed as final readings.',
      confirmText: locale.isZh ? '确认封存' : 'Confirm Seal',
    },
    dissolve: {
      title: locale.isZh ? '强制解散编队' : 'Force Dissolve Formation',
      description: locale.isZh ? '将终止当前编队，所有运行期数据将丢失。此操作不可逆。' : 'Will terminate current formation, all runtime data will be lost. This action is irreversible.',
      impact: locale.isZh ? '所有未封存的脉冲数据将丢失，成员将被移出编队。' : 'All unsealed pulse data will be lost, members will be removed.',
      confirmText: locale.isZh ? '确认解散' : 'Confirm Dissolve',
    },
  }
  dangerModal.value = { ...map[action], visible: true, action }
}

async function handleConfirm() {
  const action = dangerModal.value.action
  dangerModal.value.visible = false
  try {
    if (action === 'seal') await api.post(`/admin/formations/${route.params.id}/seal`)
    if (action === 'dissolve') await api.post(`/admin/formations/${route.params.id}/dissolve`)
    formation.value = await api.get(`/admin/formations/${route.params.id}`)
  } catch (e) { console.error(e) }
}
</script>

<template>
  <div v-if="loading">
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__body">
        <SkeletonLoader :card="true" />
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-bottom:16px;">
      <div class="base-panel">
        <div class="base-panel__body">
          <SkeletonLoader v-for="i in 4" :key="i" :avatar="true" :lines="1" />
        </div>
      </div>
      <div class="base-panel">
        <div class="base-panel__body"><SkeletonLoader :card="true" /></div>
      </div>
    </div>
  </div>
  <div v-else-if="formation">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <button class="cmd-btn" style="font-size:12px;" @click="router.push('/formations')">← {{ locale.isZh ? '返回列表' : 'Back' }}</button>
    </div>
    <!-- 状态指示器 + 编队摘要 -->
    <div class="formation-status-banner" :class="formation.status === '运行中' ? 'banner--running' : 'banner--sealed'">
      <div class="banner-indicator" />
      <span class="banner-status">{{ formation.status }}</span>
      <span style="flex:1;" />
      <StatusPill :status="formation.status === '运行中' ? 'running' : 'ok'" :label="formation.status" />
    </div>

    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header">
        <span class="base-panel__title">{{ locale.t('formation.summary') }}</span>
      </div>
      <div class="base-panel__body" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
        <div><div style="font-size:11px;color:var(--text-muted);">{{ locale.t('nav.formations') }}{{ locale.isZh ? '码' : ' Code' }}</div><div class="text-mono" style="font-size:18px;color:var(--color-cyan);">{{ formation.roomNo }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">{{ locale.t('formations.owner') }}</div><div>{{ formation.ownerName }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">{{ locale.t('formations.members') }}</div><div class="text-mono">{{ formation.memberCount }}/16</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">{{ locale.t('formations.protocol') }}</div><div>{{ formation.mode }}</div></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-bottom:16px;">
      <div class="base-panel">
        <div class="base-panel__header"><span class="base-panel__title">{{ locale.t('formation.memberSeats') }}</span></div>
        <div class="base-panel__body">
          <div v-for="m in formation.members || []" :key="m.userId" class="member-row">
            <div class="member-avatar">
              {{ (m.nickname || '?')[0] }}
            </div>
            <div class="member-info">
              <div class="member-name">{{ m.nickname || m.userId }}</div>
              <div class="member-meta">
                <span v-if="m.score != null" class="member-score">{{ m.finalScore ?? m.score }}</span>
                <span class="member-time">{{ m.joinedAt ? m.joinedAt.substring(5, 16) : '-' }}</span>
              </div>
            </div>
            <span class="member-status-dot" :class="m.quitTime ? 'dot--offline' : 'dot--online'" :title="m.quitTime ? (locale.isZh ? '已退出' : 'Offline') : (locale.isZh ? '在线' : 'Online')" />
          </div>
          <div v-if="!formation.members?.length" style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;">
            {{ locale.isZh ? '暂无成员数据' : 'No member data' }}
          </div>
        </div>
      </div>
      <div class="base-panel">
        <div class="base-panel__header"><span class="base-panel__title">{{ locale.t('formation.pulseChart') }}</span></div>
        <div class="base-panel__body" style="display:flex;align-items:center;justify-content:center;min-height:200px;">
          <EmptyState :title="locale.isZh ? '暂无脉冲数据' : 'No pulse data'" :description="locale.isZh ? '封存航程后将生成脉冲轨迹' : 'Pulse trajectory will be generated after sealing'" icon="data" />
        </div>
      </div>
    </div>

    <!-- 危险操作（可折叠） -->
    <div class="base-panel">
      <div class="base-panel__header" style="cursor:pointer;" @click="dangerExpanded = !dangerExpanded">
        <span class="base-panel__title" style="color:var(--color-red);">{{ locale.t('formation.dangerZone') }}</span>
        <span style="font-size:11px;color:var(--text-muted);transition:transform .2s;" :style="{ transform: dangerExpanded ? 'rotate(90deg)' : 'rotate(0)' }">&#9654;</span>
      </div>
      <div v-if="dangerExpanded" class="base-panel__body" style="display:flex;gap:12px;padding-top:0;">
        <CommandButton variant="danger" @click="openDanger('seal')">{{ locale.t('formation.forceSeal') }}</CommandButton>
        <CommandButton variant="danger" @click="openDanger('dissolve')">{{ locale.t('formation.forceDissolve') }}</CommandButton>
      </div>
    </div>

    <ConfirmDangerModal v-bind="dangerModal" @confirm="handleConfirm" @cancel="dangerModal.visible = false" />
  </div>
</template>

<style scoped>
.formation-status-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  margin-bottom: 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}
.banner--running {
  background: var(--pill-ok-bg);
  border-color: var(--pill-ok-border);
}
.banner--sealed {
  background: var(--pill-running-bg);
  border-color: var(--pill-running-border);
}
.banner-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.banner--running .banner-indicator {
  background: var(--color-green);
}
.banner--sealed .banner-indicator {
  background: var(--color-primary);
}
.banner-status {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}
.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--table-row-border);
}
.member-row:last-child { border-bottom: none; }
.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--btn-primary-bg);
  border: 1px solid var(--btn-primary-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  flex-shrink: 0;
}
.member-info { flex: 1; min-width: 0; }
.member-name { font-size: 13px; color: var(--text-primary); }
.member-meta { display: flex; gap: 8px; margin-top: 2px; }
.member-score { font-size: 11px; color: var(--color-cyan); font-family: var(--font-mono); }
.member-time { font-size: 10px; color: var(--text-muted); }
.member-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--online { background: var(--color-green); }
.dot--offline { background: var(--text-muted); }
</style>
