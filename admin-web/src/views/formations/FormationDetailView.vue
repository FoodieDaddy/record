<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import ConfirmDangerModal from '@/components/modal/ConfirmDangerModal.vue'
import SkeletonLoader from '@/components/feedback/SkeletonLoader.vue'

const route = useRoute()
const api = useApi()
const formation = ref<any>(null)
const loading = ref(true)
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
    seal: { title: '强制封存航程', description: '将正常结束当前任务并写入航迹档案。所有运行期脉冲数据将被归档。', impact: '编队中所有成员的当前脉冲将被封存为最终读数。', confirmText: '确认封存' },
    dissolve: { title: '强制解散编队', description: '将终止当前编队，所有运行期数据将丢失。此操作不可逆。', impact: '所有未封存的脉冲数据将丢失，成员将被移出编队。', confirmText: '确认解散' },
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
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header">
        <span class="base-panel__title">编队摘要</span>
        <StatusPill :status="formation.status === '运行中' ? 'running' : 'ok'" :label="formation.status" />
      </div>
      <div class="base-panel__body" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
        <div><div style="font-size:11px;color:var(--text-muted);">编队码</div><div class="text-mono" style="font-size:18px;color:var(--color-cyan);">{{ formation.roomNo }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">编队主控</div><div>{{ formation.ownerName }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">成员数</div><div class="text-mono">{{ formation.memberCount }}/16</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">记录协议</div><div>{{ formation.mode }}</div></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-bottom:16px;">
      <div class="base-panel">
        <div class="base-panel__header"><span class="base-panel__title">成员席位</span></div>
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
            <span class="member-status-dot" :class="m.quitTime ? 'dot--offline' : 'dot--online'" :title="m.quitTime ? '已退出' : '在线'" />
          </div>
          <div v-if="!formation.members?.length" style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;">
            暂无成员数据
          </div>
        </div>
      </div>
      <div class="base-panel">
        <div class="base-panel__header"><span class="base-panel__title">脉冲轨迹</span></div>
        <div class="base-panel__body" style="display:flex;align-items:center;justify-content:center;min-height:200px;color:var(--text-muted);font-size:12px;">ECharts 折线图 — 接入后渲染</div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__header"><span class="base-panel__title" style="color:var(--color-red);">危险操作</span></div>
      <div class="base-panel__body" style="display:flex;gap:12px;">
        <CommandButton variant="danger" @click="openDanger('seal')">强制封存航程</CommandButton>
        <CommandButton variant="danger" @click="openDanger('dissolve')">强制解散编队</CommandButton>
      </div>
    </div>

    <ConfirmDangerModal v-bind="dangerModal" @confirm="handleConfirm" @cancel="dangerModal.visible = false" />
  </div>
</template>

<style scoped>
.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.member-row:last-child { border-bottom: none; }
.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(10,132,255,0.10);
  border: 1px solid rgba(10,132,255,0.18);
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
.dot--online { background: var(--color-green); box-shadow: 0 0 6px rgba(48,209,88,0.3); }
.dot--offline { background: var(--text-muted); }
</style>
