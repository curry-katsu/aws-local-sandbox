<template>
  <v-sheet border rounded="lg" class="table-panel">
    <div class="panel-header">
      <div>
        <h2 class="text-h6">DynamoDB tables</h2>
        <p class="text-body-2 text-medium-emphasis ma-0">
          Inspect local tables and manage items through Floci.
        </p>
      </div>
      <div class="panel-actions">
        <v-btn variant="tonal" icon="mdi-refresh" :loading="loading" @click="$emit('refresh')" />
        <v-btn color="primary" prepend-icon="mdi-plus" @click="$emit('create-table')">
          New table
        </v-btn>
      </div>
    </div>

    <v-alert v-if="error" class="mx-4 mb-4" type="error" variant="tonal" density="comfortable">
      {{ error }}
    </v-alert>
    <v-alert
      v-if="statusMessage"
      class="mx-4 mb-4"
      type="info"
      variant="tonal"
      density="comfortable"
    >
      {{ statusMessage }}
    </v-alert>

    <v-list density="compact" nav>
      <v-list-item
        v-if="!loading && tables.length === 0"
        title="No DynamoDB tables found"
        subtitle="Run Terraform apply to create local resources."
      />
      <v-list-item
        v-for="table in tables"
        :key="table"
        :active="selectedTableName === table"
        prepend-icon="mdi-table"
        :title="table"
        @click="$emit('select-table', table)"
      />
    </v-list>
  </v-sheet>
</template>

<script setup>
defineProps({
  error: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  selectedTableName: { type: String, default: '' },
  statusMessage: { type: String, default: '' },
  tables: { type: Array, default: () => [] },
})

defineEmits(['create-table', 'refresh', 'select-table'])
</script>

<style scoped>
.table-panel {
  min-width: 0;
}

.panel-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 16px;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .panel-header {
    align-items: stretch;
    flex-direction: column;
  }

  .panel-actions {
    justify-content: stretch;
  }

  .panel-actions :deep(.v-btn) {
    flex: 1 1 160px;
  }
}
</style>
