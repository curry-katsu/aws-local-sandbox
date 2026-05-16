<template>
  <div class="editor-panel">
    <div v-if="editorContext" class="editor-context">
      <div>
        <div class="text-caption text-medium-emphasis">Editor target</div>
        <div class="text-body-2 font-weight-medium">{{ editorContext.title }}</div>
        <div class="text-body-2 text-medium-emphasis">{{ editorContext.description }}</div>
      </div>
      <div v-if="editorContext.keyPreview" class="key-preview">
        <v-chip
          v-for="(value, key) in editorContext.keyPreview"
          :key="key"
          size="small"
          variant="tonal"
        >
          {{ key }}: {{ formatValue(value) }}
        </v-chip>
      </div>
      <v-alert v-else type="info" variant="tonal" density="compact">
        Key values are not available from the current JSON.
      </v-alert>
    </div>

    <v-textarea
      :model-value="itemJson"
      label="Item JSON"
      density="comfortable"
      variant="outlined"
      rows="12"
      hide-details="auto"
      @update:model-value="$emit('update:itemJson', $event)"
    />
    <div class="editor-actions">
      <v-btn variant="tonal" prepend-icon="mdi-file-code-outline" @click="$emit('reset')">
        Reset sample
      </v-btn>
      <v-btn
        color="primary"
        prepend-icon="mdi-content-save-outline"
        :loading="saving"
        @click="$emit('put')"
      >
        Put item
      </v-btn>
    </div>
  </div>
</template>

<script setup>
defineProps({
  editorContext: { type: Object, default: null },
  itemJson: { type: String, default: '' },
  saving: { type: Boolean, default: false },
})

defineEmits(['put', 'reset', 'update:itemJson'])

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '(empty)'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>

<style scoped>
.editor-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.editor-context {
  background: rgba(var(--v-theme-primary), 0.06);
  border-radius: 8px;
  display: grid;
  gap: 10px;
  padding: 12px;
}

.key-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .editor-actions {
    justify-content: stretch;
  }

  .editor-actions :deep(.v-btn) {
    flex: 1 1 160px;
  }
}
</style>
