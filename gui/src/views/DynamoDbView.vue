<template>
  <div class="dynamodb-view">
    <DynamoDbTableList
      :error="error"
      :loading="loadingTables"
      :selected-table-name="selectedTableName"
      :status-message="statusMessage"
      :tables="tables"
      @create-table="openCreateTable"
      @refresh="loadTables"
      @select-table="selectTable"
    />

    <DynamoDbCreateTablePanel
      v-if="isCreatingTable"
      v-model="newTable"
      :attribute-type-options="attributeTypeOptions"
      :can-create-table="canCreateTable"
      :creating="creatingTable"
      :table-name-already-exists="tableNameAlreadyExists"
      @cancel="cancelCreateTable"
      @create="createTableFromForm"
      @open-existing="selectExistingTableByName"
    />

    <DynamoDbTableDetailPanel
      v-else
      :active-tab="activeTab"
      :attribute-definitions="attributeDefinitions"
      :attribute-type-options="attributeTypeOptions"
      :display-items="displayItems"
      :filter-form="filterForm"
      :filter-operator-options="filterOperatorOptions"
      :has-sort-key="Boolean(sortKey)"
      :item-columns="itemColumns"
      :item-json="itemJson"
      :key-schema="keySchema"
      :key-summary="keySummary"
      :loading-items="loadingItems"
      :partition-key-label="partitionKeyLabel"
      :query-form="queryForm"
      :saving-item="savingItem"
      :scan-limit="scanLimit"
      :search-limit="searchLimit"
      :selected-item="selectedItem"
      :selected-item-index="selectedItemIndex"
      :selected-table-name="selectedTableName"
      :sort-key-label="sortKeyLabel"
      :table-detail="tableDetail"
      :table-subtitle="tableSubtitle"
      @filter-scan="scanItemsWithFilter"
      @prepare-new-item="prepareNewItem"
      @put-item="putItem"
      @query="queryItems"
      @request-delete="deleteDialog = true"
      @scan="scanItems"
      @update:active-tab="activeTab = $event"
      @update:filter-form="filterForm = $event"
      @update:item-json="itemJson = $event"
      @update:query-form="queryForm = $event"
      @update:scan-limit="scanLimit = $event"
      @update:search-limit="searchLimit = $event"
      @update:selected-item-index="selectedItemIndex = $event"
    />

    <DynamoDbDeleteItemDialog
      v-model="deleteDialog"
      :deleting="deletingItem"
      :item-key-preview="selectedItemKeyPreview"
      :table-name="selectedTableName"
      @delete="deleteSelectedItem"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  buildDynamoKey,
  createTable,
  deleteTableItem,
  describeTable,
  fromDynamoItem,
  listTables,
  putTableItem,
  queryTable,
  scanTable,
} from '../aws/dynamodb'
import DynamoDbCreateTablePanel from '../components/dynamodb/DynamoDbCreateTablePanel.vue'
import DynamoDbDeleteItemDialog from '../components/dynamodb/DynamoDbDeleteItemDialog.vue'
import DynamoDbTableDetailPanel from '../components/dynamodb/DynamoDbTableDetailPanel.vue'
import DynamoDbTableList from '../components/dynamodb/DynamoDbTableList.vue'

const tables = ref([])
const selectedTableName = ref('')
const tableDetail = ref(null)
const rawItems = ref([])
const isCreatingTable = ref(false)
const loadingTables = ref(false)
const loadingItems = ref(false)
const savingItem = ref(false)
const deletingItem = ref(false)
const creatingTable = ref(false)
const error = ref('')
const statusMessage = ref('')
const activeTab = ref('items')
const scanLimit = ref(50)
const searchLimit = ref(50)
const itemJson = ref('')
const selectedItemIndex = ref(null)
const deleteDialog = ref(false)

const attributeTypeOptions = [
  { title: 'String', value: 'S' },
  { title: 'Number', value: 'N' },
  { title: 'Binary', value: 'B' },
]
const filterOperatorOptions = [
  { title: 'Equals', value: 'equals' },
  { title: 'Contains', value: 'contains' },
]

const queryForm = ref({
  partitionKeyValue: '',
  sortKeyValue: '',
})
const filterForm = ref({
  attributeName: '',
  attributeType: 'S',
  operator: 'equals',
  value: '',
})
const newTable = ref(buildDefaultTable('aws-local-sandbox-gui-table'))

const tableSubtitle = computed(() => {
  if (!selectedTableName.value) return 'Choose a table from the left panel.'
  return tableDetail.value?.TableArn || 'Loading table metadata.'
})
const keySchema = computed(() => tableDetail.value?.KeySchema || [])
const attributeDefinitions = computed(() => tableDetail.value?.AttributeDefinitions || [])
const partitionKey = computed(() => keySchema.value.find((key) => key.KeyType === 'HASH') || null)
const sortKey = computed(() => keySchema.value.find((key) => key.KeyType === 'RANGE') || null)
const partitionKeyLabel = computed(() =>
  partitionKey.value ? `${partitionKey.value.AttributeName} (partition key)` : 'Partition key',
)
const sortKeyLabel = computed(() =>
  sortKey.value ? `${sortKey.value.AttributeName} (sort key)` : 'Sort key',
)
const keySummary = computed(() => {
  if (keySchema.value.length === 0) return 'Unknown'
  return keySchema.value
    .map((key) => `${key.AttributeName} (${key.KeyType})`)
    .join(', ')
})
const tableNameAlreadyExists = computed(() => tables.value.includes(newTable.value.tableName.trim()))
const canCreateTable = computed(
  () =>
    Boolean(newTable.value.tableName.trim()) &&
    Boolean(newTable.value.partitionKeyName.trim()) &&
    !tableNameAlreadyExists.value,
)
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
  isCreatingTable.value = false
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

function openCreateTable() {
  isCreatingTable.value = true
  error.value = ''
  statusMessage.value = ''
  newTable.value = buildDefaultTable(nextTableName())
}

function cancelCreateTable() {
  isCreatingTable.value = false
}

async function selectExistingTableByName() {
  if (tableNameAlreadyExists.value) {
    await selectTable(newTable.value.tableName.trim())
  }
}

async function createTableFromForm() {
  if (!canCreateTable.value) return
  creatingTable.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    await createTable({
      ...newTable.value,
      tableName: newTable.value.tableName.trim(),
      partitionKeyName: newTable.value.partitionKeyName.trim(),
      sortKeyName: newTable.value.sortKeyName.trim(),
    })
    const createdName = newTable.value.tableName.trim()
    statusMessage.value = `Created ${createdName}.`
    await loadTables()
    await selectTable(createdName)
    isCreatingTable.value = false
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to create DynamoDB table.')
  } finally {
    creatingTable.value = false
  }
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

async function queryItems() {
  if (!selectedTableName.value) return
  loadingItems.value = true
  error.value = ''
  statusMessage.value = ''
  selectedItemIndex.value = null

  try {
    rawItems.value = await queryTable(
      selectedTableName.value,
      keySchema.value,
      attributeDefinitions.value,
      queryForm.value,
      normalizedSearchLimit(),
    )
    statusMessage.value = `Found ${rawItems.value.length} item(s) in ${selectedTableName.value}.`
    activeTab.value = 'items'
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to query DynamoDB table.')
  } finally {
    loadingItems.value = false
  }
}

async function scanItemsWithFilter() {
  if (!selectedTableName.value) return
  loadingItems.value = true
  error.value = ''
  statusMessage.value = ''
  selectedItemIndex.value = null

  try {
    rawItems.value = await scanTable(
      selectedTableName.value,
      normalizedSearchLimit(),
      filterForm.value,
    )
    statusMessage.value = `Found ${rawItems.value.length} item(s) in ${selectedTableName.value}.`
    activeTab.value = 'items'
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to scan DynamoDB table with filter.')
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
  const definition = attributeDefinitions.value.find(
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
  isCreatingTable.value = false
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

function normalizedSearchLimit() {
  const parsed = Number(searchLimit.value)
  if (!Number.isFinite(parsed)) return 50
  return Math.min(Math.max(Math.trunc(parsed), 1), 200)
}

function nextTableName() {
  const baseName = 'aws-local-sandbox-gui-table'
  if (!tables.value.includes(baseName)) {
    return baseName
  }

  let index = 2
  while (tables.value.includes(`${baseName}-${index}`)) {
    index += 1
  }
  return `${baseName}-${index}`
}

function buildDefaultTable(tableName) {
  return {
    tableName,
    partitionKeyName: 'pk',
    partitionKeyType: 'S',
    sortKeyName: '',
    sortKeyType: 'S',
    readCapacityUnits: 5,
    writeCapacityUnits: 5,
  }
}

function messageFromError(caught, fallback) {
  if (caught instanceof SyntaxError) return 'Item JSON is invalid.'
  if (caught instanceof Error && caught.message) return caught.message
  return fallback
}

onMounted(loadTables)
</script>

<style scoped>
.dynamodb-view {
  align-items: start;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
}

@media (max-width: 1100px) {
  .dynamodb-view {
    grid-template-columns: 1fr;
  }
}
</style>
