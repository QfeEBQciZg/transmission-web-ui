import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const rpcTarget = env.VITE_RPC_TARGET || 'http://127.0.0.1:9091'
  return {
    // Relative base so the built assets work when dropped into Transmission's web dir.
    base: './',
    plugins: [vue()],
    server: {
      proxy: {
        '/transmission/rpc': {
          target: rpcTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'node',
    },
  }
})
