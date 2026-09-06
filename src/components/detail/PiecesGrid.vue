<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * Pieces completeness grid: one square per piece, drawn on a canvas.
 * `pieces` is the RPC base64 bitfield (1 = we have the piece, MSB first).
 */
const props = defineProps<{
  pieces?: string
  pieceCount?: number
}>()

const CELL = 4
const GAP = 1

const canvasRef = ref<HTMLCanvasElement>()
let observer: ResizeObserver | null = null

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function draw(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const count = props.pieceCount ?? 0
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (!props.pieces || count === 0) {
    canvas.width = 0
    canvas.height = 0
    return
  }
  const bytes = base64ToBytes(props.pieces)
  const step = CELL + GAP
  const avail = canvas.parentElement?.clientWidth ?? 600
  const columns = Math.max(1, Math.floor(avail / step))
  const rows = Math.ceil(count / columns)
  canvas.width = columns * step
  canvas.height = rows * step
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < count; i++) {
    const have = (bytes[i >> 3] & (0x80 >> (i & 7))) !== 0
    ctx.fillStyle = have ? '#67c23a' : '#e4e7ed'
    ctx.fillRect((i % columns) * step, Math.floor(i / columns) * step, CELL, CELL)
  }
}

onMounted(() => {
  draw()
  const parent = canvasRef.value?.parentElement
  if (parent) {
    observer = new ResizeObserver(() => draw())
    observer.observe(parent)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watch(
  () => [props.pieces, props.pieceCount],
  () => draw(),
)
</script>

<template>
  <div class="pieces-grid">
    <canvas ref="canvasRef" />
  </div>
</template>

<style scoped>
.pieces-grid {
  width: 100%;
  line-height: 0;
}
</style>
