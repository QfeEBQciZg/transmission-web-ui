<script setup lang="ts">
import { computed } from 'vue'

/** Progress bar: colored fill + percentage text overlay. */
const props = defineProps<{
  /** 0..1 */
  ratio: number
  /** 'downloading' | 'seeding' | 'checking' | 'stopped' | 'error' | 'warning' */
  state: string
}>()

const pct = computed(() => Math.min(100, Math.max(0, props.ratio * 100)))
const text = computed(() => `${pct.value.toFixed(1)}%`)
</script>

<template>
  <div class="pbar" :class="`pbar-${state}`">
    <div class="pbar-fill" :style="{ width: `${pct}%` }" />
    <span class="pbar-text">{{ text }}</span>
  </div>
</template>

<style scoped>
.pbar {
  position: relative;
  width: 100%;
  height: 16px;
  background: #ebeef5;
  border: 1px solid var(--twui-border);
  border-radius: 2px;
  overflow: hidden;
}

.pbar-fill {
  height: 100%;
  background: #409eff;
  transition: width 0.3s;
}

.pbar-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #303133;
}

.pbar-seeding .pbar-fill {
  background: #67c23a;
}

.pbar-checking .pbar-fill,
.pbar-warning .pbar-fill {
  background: #e6a23c;
}

.pbar-error .pbar-fill {
  background: #f56c6c;
}

.pbar-stopped .pbar-fill {
  background: #909399;
}
</style>
