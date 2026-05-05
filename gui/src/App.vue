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
        <v-list-item prepend-icon="mdi-view-dashboard-outline" title="Dashboard" active />
        <v-list-item prepend-icon="mdi-bucket-outline" title="S3" />
        <v-list-item prepend-icon="mdi-database-outline" title="DynamoDB" />
        <v-list-item prepend-icon="mdi-message-outline" title="SQS" />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar flat border>
      <v-app-bar-title>Local AWS Management Console</v-app-bar-title>
      <v-chip class="mr-4" color="secondary" variant="tonal" size="small">
        {{ endpointUrl }}
      </v-chip>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-6">
        <v-row class="mb-4" align="stretch">
          <v-col cols="12" md="4">
            <v-sheet border rounded="lg" class="pa-4 h-100">
              <div class="text-caption text-medium-emphasis">Endpoint</div>
              <div class="text-body-1 font-weight-medium">{{ endpointUrl }}</div>
            </v-sheet>
          </v-col>
          <v-col cols="12" md="4">
            <v-sheet border rounded="lg" class="pa-4 h-100">
              <div class="text-caption text-medium-emphasis">Region</div>
              <div class="text-body-1 font-weight-medium">{{ region }}</div>
            </v-sheet>
          </v-col>
          <v-col cols="12" md="4">
            <v-sheet border rounded="lg" class="pa-4 h-100">
              <div class="text-caption text-medium-emphasis">Credentials</div>
              <div class="text-body-1 font-weight-medium">dummy local keys</div>
            </v-sheet>
          </v-col>
        </v-row>

        <ResourceList />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import ResourceList from './components/ResourceList.vue'

const endpointUrl = import.meta.env.VITE_AWS_ENDPOINT_URL || 'http://localhost:4566'
const region = import.meta.env.VITE_AWS_REGION || 'us-east-1'
</script>
