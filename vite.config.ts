import { defineConfig, type Plugin } from 'vite'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import pkg from './package.json'

function versionPlugin(version: string): Plugin {
  return {
    name: 'version-plugin',
    transformIndexHtml(html: string) {
      return html.replace(
        '<meta name="viewport"',
        `<meta name="version" content="${version}" />\n    <meta name="viewport"`,
      )
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ name: 'transmission-web-ui', version }, null, 2),
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const rpcTarget = env.VITE_RPC_TARGET || 'http://127.0.0.1:9091'
  return {
    // Relative base so the built assets work when dropped into Transmission's web dir.
    base: './',
    plugins: [vue(), versionPlugin(pkg.version)],
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
