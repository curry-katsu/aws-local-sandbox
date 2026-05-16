<template>
  <v-sheet border rounded="lg" class="detail-panel">
    <div class="panel-header">
      <div>
        <h2 class="text-h6">Create DynamoDB table</h2>
        <p class="text-body-2 text-medium-emphasis ma-0">
          Define a local table with a partition key and optional sort key.
        </p>
      </div>
    </div>

    <v-divider />

    <div class="create-panel">
      <v-text-field
        :model-value="modelValue.tableName"
        label="Table name"
        density="comfortable"
        variant="outlined"
        hide-details="auto"
        @update:model-value="updateField('tableName', $event)"
      />
      <div class="schema-form-grid">
        <v-text-field
          :model-value="modelValue.partitionKeyName"
          label="Partition key"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
          @update:model-value="updateField('partitionKeyName', $event)"
        />
        <v-select
          :model-value="modelValue.partitionKeyType"
          label="Type"
          :items="attributeTypeOptions"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
          @update:model-value="updateField('partitionKeyType', $event)"
        />
        <v-text-field
          :model-value="modelValue.sortKeyName"
          label="Sort key"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
          @update:model-value="updateField('sortKeyName', $event)"
        />
        <v-select
          :model-value="modelValue.sortKeyType"
          label="Type"
          :items="attributeTypeOptions"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
          @update:model-value="updateField('sortKeyType', $event)"
        />
        <v-text-field
          :model-value="modelValue.readCapacityUnits"
          label="Read capacity"
          type="number"
          min="1"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
          @update:model-value="updateField('readCapacityUnits', Number($event))"
        />
        <v-text-field
          :model-value="modelValue.writeCapacityUnits"
          label="Write capacity"
          type="number"
          min="1"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
          @update:model-value="updateField('writeCapacityUnits', Number($event))"
        />
      </div>
      <v-alert v-if="tableNameAlreadyExists" type="info" variant="tonal" density="comfortable">
        A table with this name already exists. Select the existing table instead of creating another.
      </v-alert>
      <div class="editor-actions">
        <v-btn variant="text" @click="$emit('cancel')">Cancel</v-btn>
        <v-btn
          v-if="tableNameAlreadyExists"
          variant="tonal"
          prepend-icon="mdi-open-in-new"
          @click="$emit('open-existing')"
        >
          Open existing
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          :disabled="!canCreateTable"
          :loading="creating"
          @click="$emit('create')"
        >
          Create table
        </v-btn>
      </div>
    </div>
  </v-sheet>
</template>

<script setup>
const props = defineProps({
  attributeTypeOptions: { type: Array, required: true },
  canCreateTable: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
  modelValue: { type: Object, required: true },
  tableNameAlreadyExists: { type: Boolean, default: false },
})

const emit = defineEmits(['cancel', 'create', 'open-existing', 'update:modelValue'])

function updateField(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
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

.create-panel,
.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.create-panel {
  align-items: stretch;
  flex-direction: column;
  padding: 16px;
}

.create-panel > :deep(.v-input) {
  max-width: 520px;
}

.schema-form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 760px) {
  .panel-header {
    align-items: stretch;
    flex-direction: column;
  }

  .editor-actions {
    justify-content: stretch;
  }

  .editor-actions :deep(.v-btn) {
    flex: 1 1 160px;
  }

  .schema-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
