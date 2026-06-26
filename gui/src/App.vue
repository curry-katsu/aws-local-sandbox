<template>
  <v-app>
    <v-navigation-drawer permanent width="260">
      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-cloud-outline"
          title="aws-local-sandbox"
          subtitle="Floci Console"
        />
        <v-divider class="my-2" />
        <v-list-item
          v-for="item in navigationItems"
          :key="item.path"
          :to="item.path"
          :active="route.path === item.path"
          :prepend-icon="item.icon"
          :title="item.title"
        />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar flat border>
      <v-app-bar-title>{{ selectedNavigation.title }}</v-app-bar-title>
      <v-chip class="mr-4" color="secondary" variant="tonal" size="small">
        {{ endpointUrl }}
      </v-chip>
      <v-btn
        class="mr-2"
        icon="mdi-cog-outline"
        variant="text"
        aria-label="Connection settings"
        @click="settingsDialog = true"
      />
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-6">
        <router-view />
      </v-container>
    </v-main>

    <ConnectionSettingsDialog
      v-model="settingsDialog"
      :settings="browserSettings"
      @save="saveSettings"
      @reset="resetSettings"
    />
  </v-app>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import ConnectionSettingsDialog from './components/ConnectionSettingsDialog.vue'
import {
  debugBaseUrl,
  endpoint as endpointUrl,
  region,
  resetBrowserConfig,
  saveBrowserConfig,
} from './aws/config'
import { navigationItems } from './router'

const route = useRoute()
const settingsDialog = ref(false)
const browserSettings = { endpoint: endpointUrl, debugBaseUrl, region }
const selectedNavigation = computed(() => route.meta || navigationItems[0])

function saveSettings(settings) {
  saveBrowserConfig(settings)
  window.location.reload()
}

function resetSettings() {
  resetBrowserConfig()
  window.location.reload()
}
</script>
