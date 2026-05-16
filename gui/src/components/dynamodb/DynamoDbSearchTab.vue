<template>
  <div class="search-panel">
    <div class="search-grid">
      <v-text-field
        :model-value="queryForm.partitionKeyValue"
        :label="partitionKeyLabel"
        density="comfortable"
        variant="outlined"
        hide-details="auto"
        @update:model-value="updateQuery('partitionKeyValue', $event)"
      />
      <v-text-field
        v-if="hasSortKey"
        :model-value="queryForm.sortKeyValue"
        :label="sortKeyLabel"
        density="comfortable"
        variant="outlined"
        hide-details="auto"
        @update:model-value="updateQuery('sortKeyValue', $event)"
      />
      <v-text-field
        :model-value="searchLimit"
        label="Result limit"
        type="number"
        min="1"
        max="200"
        density="comfortable"
        variant="outlined"
        hide-details="auto"
        @update:model-value="$emit('update:searchLimit', Number($event))"
      />
    </div>
    <div class="editor-actions">
      <v-btn color="primary" prepend-icon="mdi-key-search-outline" :loading="loading" @click="$emit('query')">
        Query keys
      </v-btn>
    </div>
    <v-divider />
    <div class="search-grid">
      <v-text-field
        :model-value="filterForm.attributeName"
        label="Attribute name"
        density="comfortable"
        variant="outlined"
        hide-details="auto"
        @update:model-value="updateFilter('attributeName', $event)"
      />
      <v-select
        :model-value="filterForm.attributeType"
        label="Type"
        :items="attributeTypeOptions"
        density="comfortable"
        variant="outlined"
        hide-details="auto"
        @update:model-value="updateFilter('attributeType', $event)"
      />
      <v-select
        :model-value="filterForm.operator"
        label="Operator"
        :items="filterOperatorOptions"
        density="comfortable"
        variant="outlined"
        hide-details="auto"
        @update:model-value="updateFilter('operator', $event)"
      />
      <v-text-field
        :model-value="filterForm.value"
        label="Value"
        density="comfortable"
        variant="outlined"
        hide-details="auto"
        @update:model-value="updateFilter('value', $event)"
      />
    </div>
    <div class="editor-actions">
      <v-btn variant="tonal" prepend-icon="mdi-filter-outline" :loading="loading" @click="$emit('filter-scan')">
        Scan with filter
      </v-btn>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  attributeTypeOptions: { type: Array, required: true },
  filterForm: { type: Object, required: true },
  filterOperatorOptions: { type: Array, required: true },
  hasSortKey: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  partitionKeyLabel: { type: String, default: 'Partition key' },
  queryForm: { type: Object, required: true },
  searchLimit: { type: Number, default: 50 },
  sortKeyLabel: { type: String, default: 'Sort key' },
})

const emit = defineEmits([
  'filter-scan',
  'query',
  'update:filterForm',
  'update:queryForm',
  'update:searchLimit',
])

function updateQuery(field, value) {
  emit('update:queryForm', { ...props.queryForm, [field]: value })
}

function updateFilter(field, value) {
  emit('update:filterForm', { ...props.filterForm, [field]: value })
}
</script>

<style scoped>
.search-panel {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.search-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .search-grid {
    grid-template-columns: 1fr;
  }

  .editor-actions {
    justify-content: stretch;
  }

  .editor-actions :deep(.v-btn) {
    flex: 1 1 160px;
  }
}
</style>
