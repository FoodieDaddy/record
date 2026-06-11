<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useLocaleStore } from '@/stores/locale'

const router = useRouter()
const locale = useLocaleStore()
</script>

<template>
  <div class="not-found">
    <div class="not-found__code">404</div>
    <h1 class="not-found__title">{{ locale.isZh ? '信号丢失·页面未找到' : 'Signal Lost · Page Not Found' }}</h1>
    <p class="not-found__desc">
      {{ locale.isZh ? '当前终端坐标不存在，可能在空间跃迁中丢失。' : 'The requested coordinates do not exist. The page may have been lost in a spatial jump.' }}
    </p>
    <button class="cmd-btn cmd-btn--primary" @click="router.push('/dashboard')" style="margin-top:24px;">
      {{ locale.isZh ? '返回基地总览' : 'Return to Dashboard' }}
    </button>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: 48px;
}
.not-found__code {
  font-size: 96px;
  font-weight: 900;
  color: var(--text-disabled);
  opacity: .15;
  line-height: 1;
  font-family: 'SF Mono', 'Consolas', monospace;
  margin-bottom: 8px;
}
.not-found__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 12px;
}
.not-found__desc {
  font-size: 14px;
  color: var(--text-muted);
  max-width: 420px;
  line-height: 1.6;
}
</style>
