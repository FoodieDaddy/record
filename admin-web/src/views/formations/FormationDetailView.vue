<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import ConfirmDangerModal from '@/components/modal/ConfirmDangerModal.vue'

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
  <div v-if="loading" style="color:var(--text-muted);padding:48px;text-align:center;">加载中...</div>
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
          <div v-for="m in formation.members || []" :key="m.userId" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
            <div style="width:28px;height:28px;border-radius:50%;background:rgba(10,132,255,0.10);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--color-primary);">{{ String(m.userId || '?').slice(-2) }}</div>
            <div style="flex:1;font-size:12px;">
              <div>{{ m.nickname || m.userId }}</div>
              <div style="font-size:10px;color:var(--text-muted);">加入: {{ m.joinedAt || '-' }}<template v-if="m.quitTime"> | 退出: {{ m.quitTime }}</template></div>
            </div>
            <div class="text-mono" style="font-size:12px;color:var(--color-cyan);">{{ m.finalScore ?? m.score ?? '-' }}</div>
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
