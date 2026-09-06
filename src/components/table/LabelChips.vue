<script setup lang="ts">
import { labelColor } from '../../utils/format'

/** Native labels rendered as colored chips (color = hash of the name). */
defineProps<{ labels: string[] }>()
</script>

<template>
  <span class="label-chips">
    <span v-for="l in labels" :key="l" class="chip" :style="{ backgroundColor: labelColor(l) }">
      {{ l }}
    </span>
  </span>
</template>

<style scoped>
.label-chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 3px;
}

.chip {
  padding: 0 6px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 16px;
  color: #fff;
  white-space: nowrap;
}
</style>
