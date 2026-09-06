<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { Check } from '@element-plus/icons-vue'

export interface ContextMenuItem {
  key: string
  label: string
  icon?: Component
  disabled?: boolean
  danger?: boolean
  /** Render a divider above this item */
  dividerBefore?: boolean
  /** Column-config mode: show a check mark */
  checked?: boolean
  /** Keep the menu open after clicking (column config) */
  keepOpen?: boolean
}

/** Lightweight context menu (Element Plus has no native one). */
const props = defineProps<{ x: number; y: number; items: ContextMenuItem[] }>()
const emit = defineEmits<{ select: [key: string]; close: [] }>()

const menuRef = ref<HTMLElement>()
const pos = ref({ left: '0px', top: '0px' })

// Clamp the menu inside the viewport once it is rendered.
watch(
  () => [props.x, props.y],
  async () => {
    pos.value = { left: `${props.x}px`, top: `${props.y}px` }
    await nextTick()
    const el = menuRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = Math.min(props.x, window.innerWidth - rect.width - 4)
    const top = Math.min(props.y, window.innerHeight - rect.height - 4)
    pos.value = { left: `${Math.max(4, left)}px`, top: `${Math.max(4, top)}px` }
  },
  { immediate: true },
)

function onItemClick(item: ContextMenuItem): void {
  if (item.disabled) return
  emit('select', item.key)
  if (!item.keepOpen) emit('close')
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <teleport to="body">
    <div
      class="ctx-overlay"
      @click="emit('close')"
      @contextmenu.prevent="emit('close')"
      @wheel="emit('close')"
    >
      <div ref="menuRef" class="ctx-menu" :style="pos" @click.stop>
        <template v-for="item in items" :key="item.key">
          <div v-if="item.dividerBefore" class="ctx-divider" />
          <div
            class="ctx-item"
            :class="{ disabled: item.disabled, danger: item.danger }"
            @click="onItemClick(item)"
          >
            <span class="ctx-icon">
              <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
              <el-icon v-else-if="item.checked !== undefined" :class="{ invisible: !item.checked }">
                <Check />
              </el-icon>
            </span>
            <span class="ctx-label">{{ item.label }}</span>
          </div>
        </template>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
}

.ctx-menu {
  position: fixed;
  min-width: 200px;
  padding: 4px 0;
  background: #fff;
  border: 1px solid var(--twui-border);
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px 5px 8px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.ctx-item:hover {
  background: rgba(64, 158, 255, 0.12);
}

.ctx-item.disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.ctx-item.disabled:hover {
  background: none;
}

.ctx-item.danger {
  color: #f56c6c;
}

.ctx-icon {
  width: 18px;
  display: inline-flex;
  justify-content: center;
}

.ctx-divider {
  height: 1px;
  margin: 4px 0;
  background: var(--twui-border);
}

.invisible {
  visibility: hidden;
}
</style>
