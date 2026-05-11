<template>
  <div class="editor-panel">
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
  itemJson: { type: String, default: '' },
  saving: { type: Boolean, default: false },
})

defineEmits(['put', 'reset', 'update:itemJson'])
</script>

<style scoped>
.editor-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
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
