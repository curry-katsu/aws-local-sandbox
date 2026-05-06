import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

const flociProxyTarget = process.env.FLOCI_PROXY_TARGET || 'http://localhost:4566'

export default defineConfig({
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
    },
  },
})
