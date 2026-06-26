<template>
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
</template>

<script setup>
import ResourceList from '../components/ResourceList.vue'
import { endpoint as endpointUrl, region } from '../aws/config'
</script>
