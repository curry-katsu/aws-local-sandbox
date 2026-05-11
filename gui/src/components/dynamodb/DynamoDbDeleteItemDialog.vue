<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>Delete DynamoDB item</v-card-title>
      <v-card-text>
        Delete the selected item from <strong>{{ tableName }}</strong> using its table key.
        This only affects the local Floci store.
        <pre class="dialog-preview">{{ formatJson(itemKeyPreview) }}</pre>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="error" :loading="deleting" @click="$emit('delete')">Delete</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
defineProps({
  deleting: { type: Boolean, default: false },
  itemKeyPreview: { type: Object, default: null },
  modelValue: { type: Boolean, default: false },
  tableName: { type: String, default: '' },
})

defineEmits(['delete', 'update:modelValue'])

function formatJson(value) {
  return JSON.stringify(value || {}, null, 2)
}
</script>

<style scoped>
.dialog-preview {
  background: rgba(var(--v-theme-surface-variant), 0.4);
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  margin-top: 12px;
  max-height: 180px;
  overflow: auto;
  padding: 12px;
  white-space: pre-wrap;
}
</style>
