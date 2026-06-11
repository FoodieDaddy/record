<script setup lang="ts">
import { ref, computed, type PropType } from 'vue'

const props = defineProps({
  data: { type: [Object, Array, String, Number, Boolean, null] as PropType<unknown>, required: true },
  depth: { type: Number, default: 0 },
  keyName: { type: String, default: '' },
})

const collapsed = ref(props.depth >= 2)

function toggle() {
  collapsed.value = !collapsed.value
}

const isObject = computed(() => props.data !== null && typeof props.data === 'object')
const isArray = computed(() => Array.isArray(props.data))
const isPrimitive = computed(() => !isObject.value)

const entries = computed(() => {
  if (isObject.value && !isArray.value) {
    return Object.entries(props.data as Record<string, unknown>)
  }
  if (isArray.value) {
    return (props.data as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
  }
  return []
})

function getTypeClass(value: unknown): string {
  if (value === null || value === undefined) return 'json-null'
  if (typeof value === 'string') return 'json-string'
  if (typeof value === 'number') return 'json-number'
  if (typeof value === 'boolean') return 'json-boolean'
  return ''
}

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return `"${value}"`
  return String(value)
}
</script>

<template>
  <div class="json-tree">
    <!-- 原始值 -->
    <div v-if="isPrimitive" class="json-node json-node--primitive" :style="{ paddingLeft: depth * 16 + 'px' }">
      <span v-if="keyName" class="json-key">{{ keyName }}<span class="json-colon">: </span></span>
      <span :class="getTypeClass(data)">{{ formatPrimitive(data) }}</span>
    </div>

    <!-- 对象/数组 -->
    <div v-else class="json-node" :style="{ paddingLeft: depth * 16 + 'px' }">
      <div class="json-node__header" @click="toggle">
        <span class="json-arrow" :class="{ 'json-arrow--collapsed': collapsed }">▶</span>
        <span v-if="keyName" class="json-key">{{ keyName }}<span class="json-colon">: </span></span>
        <span class="json-bracket">{{ isArray ? '[' : '{' }}</span>
        <span v-if="collapsed" class="json-ellipsis">
          {{ isArray ? '…' : '{…}' }}
          <span class="json-count"> {{ entries.length }} {{ isArray ? 'items' : 'keys' }}</span>
        </span>
        <span v-if="collapsed" class="json-bracket">{{ isArray ? ']' : '}' }}</span>
      </div>

      <div v-if="!collapsed" class="json-node__children">
        <JsonTreeView
          v-for="([entryKey, entryValue], idx) in entries"
          :key="idx"
          :key-name="String(entryKey)"
          :data="entryValue"
          :depth="depth + 1"
        />
        <div class="json-node__closing" :style="{ paddingLeft: depth * 16 + 'px' }">
          <span class="json-bracket">{{ isArray ? ']' : '}' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.json-tree {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.7;
  color: #D1D5DB;
  user-select: text;
}

.json-node__header {
  display: flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  padding: 1px 0;
  transition: background 0.12s;
  border-radius: 3px;
}
.json-node__header:hover {
  background: rgba(255, 255, 255, 0.04);
}

.json-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 8px;
  color: #6B7280;
  transition: transform 0.15s ease;
  flex-shrink: 0;
}
.json-arrow--collapsed {
  transform: rotate(-90deg);
}

.json-key {
  color: #93C5FD;
  font-weight: 500;
}
.json-colon {
  color: #9CA3AF;
}

.json-bracket {
  color: #F59E0B;
  font-weight: 600;
}

.json-ellipsis {
  color: #6B7280;
  font-style: italic;
  margin: 0 2px;
}
.json-count {
  color: #4B5563;
  font-size: 10px;
}

.json-node__children {
  border-left: 1px solid rgba(255, 255, 255, 0.06);
  margin-left: 8px;
}

.json-node__closing {
  padding: 1px 0;
}

.json-node--primitive {
  padding: 1px 0;
}

/* Type colors — 控制台冷光基调 */
.json-string {
  color: #6EE7B7;
}
.json-number {
  color: #60A5FA;
}
.json-boolean {
  color: #C084FC;
}
.json-null {
  color: #9CA3AF;
  font-style: italic;
}
</style>
