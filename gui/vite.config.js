import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

const flociProxyTarget = process.env.FLOCI_PROXY_TARGET || 'http://localhost:4566'
const debugProxyTarget = process.env.DEBUG_PROXY_TARGET || 'http://localhost:5180'
const basePath = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base: basePath,
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/floci': {
        target: flociProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/floci/, ''),
      },
      '/debug': {
        target: debugProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
