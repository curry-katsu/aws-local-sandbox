import { config } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

globalThis.visualViewport = {
  width: 1024,
  height: 768,
  offsetLeft: 0,
  offsetTop: 0,
  pageLeft: 0,
  pageTop: 0,
  scale: 1,
  addEventListener: () => {},
  removeEventListener: () => {},
}

export const vuetify = createVuetify({ components, directives })

// Expose Vuetify for component tests; do NOT set config.global.plugins here
// to avoid double-registration when tests also pass plugins to mount().
config.global.plugins = [vuetify]
