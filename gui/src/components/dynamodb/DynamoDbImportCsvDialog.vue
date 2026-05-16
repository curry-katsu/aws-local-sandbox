<template>
  <v-dialog
    :model-value="modelValue"
    max-width="540"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>Import DynamoDB CSV</v-card-title>
      <v-card-text>
        Import <strong>{{ fileName || 'selected CSV file' }}</strong> into
        <strong>{{ tableName }}</strong>. Each row is written with <code>PutItem</code>, so
        existing items with matching key values will be overwritten.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" :loading="importing" @click="$emit('import')">Import</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
defineProps({
  fileName: { type: String, default: '' },
  importing: { type: Boolean, default: false },
  modelValue: { type: Boolean, default: false },
  tableName: { type: String, default: '' },
})

defineEmits(['import', 'update:modelValue'])
</script>
