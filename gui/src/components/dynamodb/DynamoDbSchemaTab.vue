<template>
  <div class="schema-grid">
    <div>
      <div class="text-caption text-medium-emphasis mb-2">Key schema</div>
      <pre>{{ formatJson(keySchema) }}</pre>
    </div>
    <div>
      <div class="text-caption text-medium-emphasis mb-2">Attribute definitions</div>
      <pre>{{ formatJson(attributeDefinitions) }}</pre>
    </div>
  </div>
</template>

<script setup>
defineProps({
  attributeDefinitions: { type: Array, default: () => [] },
  keySchema: { type: Array, default: () => [] },
})

function formatJson(value) {
  return JSON.stringify(value || {}, null, 2)
}
</script>

<style scoped>
.schema-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 16px;
}

pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  margin: 0;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
}

@media (max-width: 760px) {
  .schema-grid {
    grid-template-columns: 1fr;
  }
}
</style>
