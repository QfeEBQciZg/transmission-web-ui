<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { version } from '../../../package.json'
import logoUrl from '../../assets/logo.svg'
import { useSessionStore } from '../../stores/session'

/** About dialog: app identity + live daemon info. */
const { t } = useI18n()
const session = useSessionStore()

const visible = ref(false)

function open(): void {
  visible.value = true
}

defineExpose({ open })
</script>

<template>
  <el-dialog v-model="visible" :title="t('about.title')" width="440px">
    <div class="about">
      <div class="about-header">
        <img :src="logoUrl" class="about-logo" alt="Transmission Web UI" />
        <div class="about-info">
          <h3 class="name">{{ t('app.title') }}</h3>
          <p class="desc">{{ t('about.description') }}</p>
        </div>
      </div>
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item :label="t('about.version')">{{ version }}</el-descriptions-item>
        <el-descriptions-item v-if="session.connected" :label="t('about.daemon')">
          Transmission {{ session.daemonVersion }} · RPC {{ session.rpcVersionSemver }}
        </el-descriptions-item>
      </el-descriptions>
      <p class="original">
        <el-link href="./index.original.html" target="_blank" type="info">
          {{ t('about.originalUI') }}
        </el-link>
      </p>
    </div>
    <template #footer>
      <el-button type="primary" @click="visible = false">{{ t('about.close') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.about-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.about-logo {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.about-info {
  flex: 1;
  min-width: 0;
}

.name {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--twui-text-primary);
}

.desc {
  margin: 0;
  color: var(--twui-text-secondary);
  font-size: 13px;
  line-height: 1.4;
}

.original {
  margin: 12px 0 0;
  font-size: 12px;
}
</style>
