<template>
  <v-sheet border rounded="lg" class="detail-panel">
    <div class="panel-header">
      <div>
        <h2 class="text-h6">{{ selectedTableName || 'Select a table' }}</h2>
        <p class="text-body-2 text-medium-emphasis ma-0">
          {{ tableSubtitle }}
        </p>
      </div>
      <div class="panel-actions">
        <v-btn
          variant="tonal"
          prepend-icon="mdi-database-search-outline"
          :disabled="!selectedTableName"
          :loading="loadingItems"
          @click="$emit('scan')"
        >
          Scan
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          :disabled="!selectedTableName"
          @click="$emit('prepare-new-item')"
        >
          Add item
        </v-btn>
      </div>
    </div>

    <v-divider />

    <div v-if="!selectedTableName" class="empty-state">
      <v-icon icon="mdi-database-outline" size="44" />
      <div class="text-body-1 font-weight-medium">Choose a DynamoDB table</div>
      <div class="text-body-2 text-medium-emphasis">
        Table metadata, scanned items, and write operations appear here.
      </div>
    </div>

    <template v-else>
      <div class="summary-grid">
        <div class="summary-cell">
          <div class="text-caption text-medium-emphasis">Status</div>
          <div class="text-body-2 font-weight-medium">
            {{ tableDetail?.TableStatus || 'Not loaded' }}
          </div>
        </div>
        <div class="summary-cell">
          <div class="text-caption text-medium-emphasis">Items</div>
          <div class="text-body-2 font-weight-medium">
            {{ tableDetail?.ItemCount ?? 'Unknown' }}
          </div>
        </div>
        <div class="summary-cell">
          <div class="text-caption text-medium-emphasis">Keys</div>
          <div class="text-body-2 font-weight-medium">{{ keySummary }}</div>
        </div>
      </div>

      <v-tabs
        :model-value="activeTab"
        density="comfortable"
        @update:model-value="$emit('update:activeTab', $event)"
      >
        <v-tab value="items">Items</v-tab>
        <v-tab value="search">Search</v-tab>
        <v-tab value="schema">Schema</v-tab>
        <v-tab value="editor">Editor</v-tab>
      </v-tabs>

      <v-window
        :model-value="activeTab"
        @update:model-value="$emit('update:activeTab', $event)"
      >
        <v-window-item value="items">
          <DynamoDbItemsTab
            :display-items="displayItems"
            :exporting-csv="exportingCsv"
            :importing-csv="importingCsv"
            :item-columns="itemColumns"
            :loading-items="loadingItems"
            :result-context="resultContext"
            :scan-limit="scanLimit"
            :selected-item="selectedItem"
            :selected-item-index="selectedItemIndex"
            @delete-selected="$emit('request-delete')"
            @edit-selected="$emit('edit-selected-item')"
            @export-csv="$emit('export-csv')"
            @import-csv="$emit('import-csv', $event)"
            @update:scan-limit="$emit('update:scanLimit', $event)"
            @update:selected-item-index="$emit('update:selectedItemIndex', $event)"
          />
        </v-window-item>

        <v-window-item value="search">
          <DynamoDbSearchTab
            :attribute-type-options="attributeTypeOptions"
            :filter-form="filterForm"
            :filter-operator-options="filterOperatorOptions"
            :has-sort-key="hasSortKey"
            :loading="loadingItems"
            :partition-key-label="partitionKeyLabel"
            :query-form="queryForm"
            :search-limit="searchLimit"
            :sort-key-label="sortKeyLabel"
            @filter-scan="$emit('filter-scan')"
            @query="$emit('query')"
            @update:filter-form="$emit('update:filterForm', $event)"
            @update:query-form="$emit('update:queryForm', $event)"
            @update:search-limit="$emit('update:searchLimit', $event)"
          />
        </v-window-item>

        <v-window-item value="schema">
          <DynamoDbSchemaTab
            :attribute-definitions="attributeDefinitions"
            :key-schema="keySchema"
          />
        </v-window-item>

        <v-window-item value="editor">
          <DynamoDbItemEditorTab
            :editor-context="editorContext"
            :item-json="itemJson"
            :saving="savingItem"
            @put="$emit('put-item')"
            @reset="$emit('prepare-new-item')"
            @update:item-json="$emit('update:itemJson', $event)"
          />
        </v-window-item>
      </v-window>
    </template>
  </v-sheet>
</template>

<script setup>
import DynamoDbItemEditorTab from './DynamoDbItemEditorTab.vue'
import DynamoDbItemsTab from './DynamoDbItemsTab.vue'
import DynamoDbSchemaTab from './DynamoDbSchemaTab.vue'
import DynamoDbSearchTab from './DynamoDbSearchTab.vue'

defineProps({
  activeTab: { type: String, default: 'items' },
  attributeDefinitions: { type: Array, default: () => [] },
  attributeTypeOptions: { type: Array, required: true },
  displayItems: { type: Array, default: () => [] },
  editorContext: { type: Object, default: null },
  exportingCsv: { type: Boolean, default: false },
  filterForm: { type: Object, required: true },
  filterOperatorOptions: { type: Array, required: true },
  hasSortKey: { type: Boolean, default: false },
  importingCsv: { type: Boolean, default: false },
  itemColumns: { type: Array, default: () => [] },
  itemJson: { type: String, default: '' },
  keySchema: { type: Array, default: () => [] },
  keySummary: { type: String, default: 'Unknown' },
  loadingItems: { type: Boolean, default: false },
  partitionKeyLabel: { type: String, default: 'Partition key' },
  queryForm: { type: Object, required: true },
  resultContext: { type: Object, default: null },
  savingItem: { type: Boolean, default: false },
  scanLimit: { type: Number, default: 50 },
  searchLimit: { type: Number, default: 50 },
  selectedItem: { type: Object, default: null },
  selectedItemIndex: { type: Number, default: null },
  selectedTableName: { type: String, default: '' },
  sortKeyLabel: { type: String, default: 'Sort key' },
  tableDetail: { type: Object, default: null },
  tableSubtitle: { type: String, default: '' },
})

defineEmits([
  'filter-scan',
  'edit-selected-item',
  'export-csv',
  'import-csv',
  'prepare-new-item',
  'put-item',
  'query',
  'request-delete',
  'scan',
  'update:activeTab',
  'update:filterForm',
  'update:itemJson',
  'update:queryForm',
  'update:scanLimit',
  'update:searchLimit',
  'update:selectedItemIndex',
])
</script>

<style scoped>
.detail-panel {
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

.empty-state {
  align-items: center;
  display: grid;
  gap: 8px;
  justify-items: center;
  min-height: 360px;
  padding: 24px;
  text-align: center;
}

.summary-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 16px;
}

.summary-cell {
  background: rgba(var(--v-theme-surface-variant), 0.36);
  border-radius: 8px;
  min-width: 0;
  padding: 12px;
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

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
