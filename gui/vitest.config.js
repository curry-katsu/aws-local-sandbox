import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-utils/setup.js'],
    server: {
      deps: {
        inline: ['vuetify'],
      },
    },
    exclude: ['node_modules', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/aws/**'],
      exclude: ['src/aws/__tests__/**'],
    },
  },
})
