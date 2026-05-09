<template>
  <div class="dynamodb-console">
    <v-sheet border rounded="lg" class="table-panel">
      <div class="panel-header">
        <div>
          <h2 class="text-h6">DynamoDB tables</h2>
          <p class="text-body-2 text-medium-emphasis ma-0">
            Inspect local tables and manage items through Floci.
          </p>
        </div>
        <v-btn
          color="primary"
          prepend-icon="mdi-refresh"
          :loading="loadingTables"
          @click="loadTables"
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
          v-if="!loadingTables && tables.length === 0"
          title="No DynamoDB tables found"
          subtitle="Run Terraform apply to create local resources."
        />
        <v-list-item
          v-for="table in tables"
          :key="table"
          :active="selectedTableName === table"
          prepend-icon="mdi-table"
          :title="table"
          @click="selectTable(table)"
        />
      </v-list>
    </v-sheet>

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
            @click="scanItems"
          >
            Scan
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            :disabled="!selectedTableName"
            @click="prepareNewItem"
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

        <v-tabs v-model="activeTab" density="comfortable">
          <v-tab value="items">Items</v-tab>
          <v-tab value="schema">Schema</v-tab>
          <v-tab value="editor">Editor</v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
          <v-window-item value="items">
            <div class="items-toolbar">
              <v-text-field
                v-model.number="scanLimit"
                label="Scan limit"
                type="number"
                min="1"
                max="200"
                density="compact"
                variant="outlined"
                hide-details
              />
              <v-btn
                variant="tonal"
                prepend-icon="mdi-delete-outline"
                color="error"
                :disabled="selectedItemIndex === null"
                @click="deleteDialog = true"
              >
                Delete selected
              </v-btn>
            </div>

            <v-table density="compact" class="item-table">
              <thead>
                <tr>
                  <th class="select-column">Select</th>
                  <th v-for="column in itemColumns" :key="column">{{ column }}</th>
                  <th>Raw JSON</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!loadingItems && displayItems.length === 0">
                  <td :colspan="itemColumns.length + 2" class="text-medium-emphasis">
                    No items loaded.
                  </td>
                </tr>
                <tr
                  v-for="(item, index) in displayItems"
                  :key="item.__rowKey"
                  :class="{ 'selected-row': selectedItemIndex === index }"
                  @click="selectedItemIndex = index"
                >
                  <td>
                    <v-radio
                      :model-value="selectedItemIndex"
                      :value="index"
                      density="compact"
                      hide-details
                    />
                  </td>
                  <td v-for="column in itemColumns" :key="column" class="value-cell">
                    {{ formatCellValue(item.value[column]) }}
                  </td>
                  <td class="json-cell">{{ formatJsonCompact(item.value) }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-window-item>

          <v-window-item value="schema">
            <div class="schema-grid">
              <div>
                <div class="text-caption text-medium-emphasis mb-2">Key schema</div>
                <pre>{{ formatJson(tableDetail?.KeySchema || []) }}</pre>
              </div>
              <div>
                <div class="text-caption text-medium-emphasis mb-2">Attribute definitions</div>
                <pre>{{ formatJson(tableDetail?.AttributeDefinitions || []) }}</pre>
              </div>
            </div>
          </v-window-item>

          <v-window-item value="editor">
            <div class="editor-panel">
              <v-textarea
                v-model="itemJson"
                label="Item JSON"
                density="comfortable"
                variant="outlined"
                rows="12"
                hide-details="auto"
              />
              <div class="editor-actions">
                <v-btn variant="tonal" prepend-icon="mdi-file-code-outline" @click="prepareNewItem">
                  Reset sample
                </v-btn>
                <v-btn
                  color="primary"
                  prepend-icon="mdi-content-save-outline"
                  :loading="savingItem"
                  @click="putItem"
                >
                  Put item
                </v-btn>
              </div>
            </div>
          </v-window-item>
        </v-window>
      </template>
    </v-sheet>

    <v-dialog v-model="deleteDialog" max-width="520">
      <v-card>
        <v-card-title>Delete DynamoDB item</v-card-title>
        <v-card-text>
          Delete the selected item from <strong>{{ selectedTableName }}</strong> using its table key.
          This only affects the local Floci store.
          <pre class="dialog-preview">{{ formatJson(selectedItemKeyPreview) }}</pre>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deletingItem" @click="deleteSelectedItem">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  buildDynamoKey,
  deleteTableItem,
  describeTable,
  fromDynamoItem,
  listTables,
  putTableItem,
  scanTable,
} from '../aws/dynamodb'

const tables = ref([])
const selectedTableName = ref('')
const tableDetail = ref(null)
const rawItems = ref([])
const loadingTables = ref(false)
const loadingItems = ref(false)
const savingItem = ref(false)
const deletingItem = ref(false)
const error = ref('')
const statusMessage = ref('')
const activeTab = ref('items')
const scanLimit = ref(50)
const itemJson = ref('')
const selectedItemIndex = ref(null)
const deleteDialog = ref(false)

const tableSubtitle = computed(() => {
  if (!selectedTableName.value) return 'Choose a table from the left panel.'
  return tableDetail.value?.TableArn || 'Loading table metadata.'
})

const keySchema = computed(() => tableDetail.value?.KeySchema || [])
const keySummary = computed(() => {
  if (keySchema.value.length === 0) return 'Unknown'
  return keySchema.value
    .map((key) => `${key.AttributeName} (${key.KeyType})`)
    .join(', ')
})

const displayItems = computed(() =>
  rawItems.value.map((rawItem, index) => ({
    raw: rawItem,
    value: fromDynamoItem(rawItem),
    __rowKey: `${selectedTableName.value}:${index}:${JSON.stringify(rawItem)}`,
  })),
)

const itemColumns = computed(() => {
  const columns = new Set(keySchema.value.map((key) => key.AttributeName))
  for (const item of displayItems.value) {
    for (const key of Object.keys(item.value)) {
      columns.add(key)
    }
  }
  return Array.from(columns).slice(0, 8)
})

const selectedItem = computed(() => {
  if (selectedItemIndex.value === null) return null
  return displayItems.value[selectedItemIndex.value] || null
})

const selectedItemKeyPreview = computed(() => {
  if (!selectedItem.value) return null
  return fromDynamoItem(buildDynamoKey(selectedItem.value.raw, keySchema.value))
})

async function loadTables() {
  loadingTables.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    tables.value = await listTables()
    if (!selectedTableName.value && tables.value.length > 0) {
      await selectTable(tables.value[0])
    } else if (selectedTableName.value && !tables.value.includes(selectedTableName.value)) {
      resetSelection()
    }
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load DynamoDB tables.')
  } finally {
    loadingTables.value = false
  }
}

async function selectTable(tableName) {
  selectedTableName.value = tableName
  tableDetail.value = null
  rawItems.value = []
  selectedItemIndex.value = null
  activeTab.value = 'items'
  error.value = ''
  statusMessage.value = ''

  await loadTableDetail()
  await scanItems()
  itemJson.value = JSON.stringify(buildSampleItem(), null, 2)
  activeTab.value = 'items'
}

async function loadTableDetail() {
  if (!selectedTableName.value) return

  try {
    tableDetail.value = await describeTable(selectedTableName.value)
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load table metadata.')
  }
}

async function scanItems() {
  if (!selectedTableName.value) return
  loadingItems.value = true
  error.value = ''
  statusMessage.value = ''
  selectedItemIndex.value = null

  try {
    rawItems.value = await scanTable(selectedTableName.value, normalizedScanLimit())
    statusMessage.value = `Loaded ${rawItems.value.length} item(s) from ${selectedTableName.value}.`
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to scan DynamoDB table.')
  } finally {
    loadingItems.value = false
  }
}

function prepareNewItem() {
  activeTab.value = 'editor'
  itemJson.value = JSON.stringify(buildSampleItem(), null, 2)
}

function buildSampleItem() {
  const sample = {}
  for (const key of keySchema.value) {
    sample[key.AttributeName] = sampleValueForAttribute(key.AttributeName)
  }
  return sample
}

function sampleValueForAttribute(attributeName) {
  const definition = (tableDetail.value?.AttributeDefinitions || []).find(
    (attribute) => attribute.AttributeName === attributeName,
  )

  if (definition?.AttributeType === 'N') return Date.now()
  if (definition?.AttributeType === 'B') return 'base64-encoded-value'
  return `sample-${Date.now()}`
}

async function putItem() {
  if (!selectedTableName.value) return
  savingItem.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const parsed = JSON.parse(itemJson.value)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('Item JSON must be an object.')
    }

    await putTableItem(selectedTableName.value, parsed)

    statusMessage.value = `Saved item to ${selectedTableName.value}.`
    activeTab.value = 'items'
    await scanItems()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to put DynamoDB item.')
  } finally {
    savingItem.value = false
  }
}

async function deleteSelectedItem() {
  if (!selectedTableName.value || !selectedItem.value) return
  deletingItem.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    await deleteTableItem(selectedTableName.value, selectedItem.value.raw, keySchema.value)
    deleteDialog.value = false
    statusMessage.value = `Deleted item from ${selectedTableName.value}.`
    await scanItems()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to delete DynamoDB item.')
  } finally {
    deletingItem.value = false
  }
}

function resetSelection() {
  selectedTableName.value = ''
  tableDetail.value = null
  rawItems.value = []
  selectedItemIndex.value = null
}

function normalizedScanLimit() {
  const parsed = Number(scanLimit.value)
  if (!Number.isFinite(parsed)) return 50
  return Math.min(Math.max(Math.trunc(parsed), 1), 200)
}

function formatCellValue(value) {
  if (value === undefined) return ''
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatJson(value) {
  return JSON.stringify(value || {}, null, 2)
}

function formatJsonCompact(value) {
  return JSON.stringify(value)
}

function messageFromError(caught, fallback) {
  if (caught instanceof SyntaxError) return 'Item JSON is invalid.'
  if (caught instanceof Error && caught.message) return caught.message
  return fallback
}

onMounted(loadTables)
</script>

<style scoped>
.dynamodb-console {
  align-items: start;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
}

.table-panel,
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

.panel-actions,
.editor-actions,
.items-toolbar {
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

.items-toolbar {
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.items-toolbar :deep(.v-input) {
  flex: 0 0 160px;
}

.item-table {
  padding: 0 16px 16px;
}

.select-column {
  width: 82px;
}

.selected-row {
  background: rgba(var(--v-theme-primary), 0.08);
}

.value-cell,
.json-cell,
pre,
.dialog-preview {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
}

.value-cell,
.json-cell {
  max-width: 340px;
  overflow-wrap: anywhere;
}

.schema-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 16px;
}

.editor-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
}

pre {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
}

.dialog-preview {
  background: rgba(var(--v-theme-surface-variant), 0.4);
  border-radius: 8px;
  margin-top: 12px;
  max-height: 180px;
  overflow: auto;
  padding: 12px;
  white-space: pre-wrap;
}

@media (max-width: 1100px) {
  .dynamodb-console {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .panel-header,
  .items-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .panel-actions,
  .editor-actions {
    justify-content: stretch;
  }

  .panel-actions :deep(.v-btn),
  .editor-actions :deep(.v-btn) {
    flex: 1 1 160px;
  }

  .summary-grid,
  .schema-grid {
    grid-template-columns: 1fr;
  }
}
</style>
