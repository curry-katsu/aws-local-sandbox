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
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-6">
        <router-view />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { navigationItems } from './router'

const endpointUrl = import.meta.env.VITE_AWS_BROWSER_ENDPOINT_URL || `${window.location.origin}/floci`
const route = useRoute()
const selectedNavigation = computed(() => route.meta || navigationItems[0])
</script>
