import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import App from './App.vue'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'sandboxTheme',
    themes: {
      sandboxTheme: {
        dark: false,
        colors: {
          background: '#f7f8fa',
          surface: '#ffffff',
          primary: '#2457a6',
          secondary: '#2f6f62',
          accent: '#8a5a18',
        },
      },
    },
  },
})

createApp(App).use(vuetify).mount('#app')
