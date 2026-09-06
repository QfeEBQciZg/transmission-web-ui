<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import logoUrl from '../../assets/logo.svg'

const { t } = useI18n()
</script>

<template>
  <header class="app-header">
    <img :src="logoUrl" class="app-logo" alt="Transmission Logo" />
    <h1 class="app-title">{{ t('app.title') }}</h1>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 16px;
  flex: none;
  background: var(--twui-header-bg);
  color: var(--twui-header-fg);
}

.app-logo {
  width: 26px;
  height: 26px;
  border-radius: 6px;
}

.app-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
</style>
