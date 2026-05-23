<template>
  <v-sheet border rounded="lg">
    <div class="resource-header">
      <div>
        <h2 class="text-h6">Resources</h2>
        <p class="text-body-2 text-medium-emphasis ma-0">
          S3, DynamoDB, SQS, SNS, Lambda, RDS, Cognito, EventBridge, and Step Functions resources discovered through AWS SDK v3.
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="loadResources"
      >
        Refresh
      </v-btn>
    </div>

    <v-alert
      v-if="error"
      class="mx-4 mb-4"
      type="error"
      variant="tonal"
      density="comfortable"
    >
      {{ error }}
    </v-alert>

    <v-table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Name</th>
          <th>Identifier</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!loading && resources.length === 0">
          <td colspan="3" class="text-medium-emphasis">No resources found.</td>
        </tr>
        <tr v-for="resource in resources" :key="`${resource.service}:${resource.id}`">
          <td>
            <v-chip size="small" variant="tonal">{{ resource.service }}</v-chip>
          </td>
          <td>{{ resource.name }}</td>
          <td class="resource-id">{{ resource.id }}</td>
        </tr>
      </tbody>
    </v-table>
  </v-sheet>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { discoverResources } from '../aws/resources'

const loading = ref(false)
const error = ref('')
const resources = ref([])

async function loadResources() {
  loading.value = true
  error.value = ''

  try {
    const result = await discoverResources()
    resources.value = result.resources

    if (result.failedServices.length > 0) {
      error.value = `Some resource types failed to load: ${result.failedServices.join(', ')}.`
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Failed to load resources.'
  } finally {
    loading.value = false
  }
}

onMounted(loadResources)
</script>

<style scoped>
.resource-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 16px;
}

.resource-id {
  color: rgb(var(--v-theme-on-surface-variant));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
  max-width: 520px;
  overflow-wrap: anywhere;
}
</style>
