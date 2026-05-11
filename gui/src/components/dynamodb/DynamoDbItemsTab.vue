<template>
  <div class="items-toolbar">
    <v-text-field
      :model-value="scanLimit"
      label="Scan limit"
      type="number"
      min="1"
      max="200"
      density="compact"
      variant="outlined"
      hide-details
      @update:model-value="$emit('update:scanLimit', Number($event))"
    />
    <v-btn
      variant="tonal"
      prepend-icon="mdi-delete-outline"
      color="error"
      :disabled="selectedItemIndex === null"
      @click="$emit('delete-selected')"
    >
      Delete selected
    </v-btn>
  </div>

  <div class="item-table-wrap">
    <v-table density="compact" class="item-table">
      <thead>
        <tr>
          <th class="select-column">Select</th>
          <th v-for="column in itemColumns" :key="column" class="value-column">
            {{ column }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!loadingItems && displayItems.length === 0">
          <td :colspan="itemColumns.length + 1" class="text-medium-emphasis">
            No items loaded.
          </td>
        </tr>
        <tr
          v-for="(item, index) in displayItems"
          :key="item.__rowKey"
          :class="{ 'selected-row': selectedItemIndex === index }"
          @click="$emit('update:selectedItemIndex', index)"
        >
          <td>
            <v-radio
              :model-value="selectedItemIndex"
              :value="index"
              density="compact"
              hide-details
            />
          </td>
          <td
            v-for="column in itemColumns"
            :key="column"
            class="value-cell"
            :title="formatCellValue(item.value[column])"
          >
            {{ formatCellValue(item.value[column]) }}
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>

  <v-expansion-panels v-if="selectedItem" class="selected-item-panel" variant="accordion">
    <v-expansion-panel title="Selected item JSON">
      <v-expansion-panel-text>
        <pre>{{ formatJson(selectedItem.value) }}</pre>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script setup>
defineProps({
  displayItems: { type: Array, default: () => [] },
  itemColumns: { type: Array, default: () => [] },
  loadingItems: { type: Boolean, default: false },
  scanLimit: { type: Number, default: 50 },
  selectedItem: { type: Object, default: null },
  selectedItemIndex: { type: Number, default: null },
})

defineEmits(['delete-selected', 'update:scanLimit', 'update:selectedItemIndex'])

function formatCellValue(value) {
  if (value === undefined) return ''
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatJson(value) {
  return JSON.stringify(value || {}, null, 2)
}
</script>

<style scoped>
.items-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
  padding: 16px;
}

.items-toolbar :deep(.v-input) {
  flex: 0 0 160px;
}

.item-table-wrap {
  margin: 0 16px 16px;
  overflow-x: auto;
}

.item-table {
  min-width: 760px;
  table-layout: fixed;
}

.select-column {
  width: 82px;
}

.value-column {
  min-width: 160px;
  width: 220px;
}

.selected-row {
  background: rgba(var(--v-theme-primary), 0.08);
}

.value-cell,
pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
}

.value-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-item-panel {
  padding: 0 16px 16px;
}

pre {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
}

@media (max-width: 760px) {
  .items-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
