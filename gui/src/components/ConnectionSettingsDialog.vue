<template>
  <v-dialog :model-value="modelValue" max-width="640" @update:model-value="close">
    <v-card>
      <v-card-title>Connection settings</v-card-title>
      <v-card-text>
        <v-alert class="mb-4" type="info" variant="tonal" density="comfortable">
          Saving or resetting reloads the GUI so every AWS client uses the same settings.
        </v-alert>

        <v-text-field
          v-model="form.endpoint"
          label="Floci endpoint"
          placeholder="http://localhost:4566"
          hint="Use an absolute URL for the hosted GUI, or /floci with the local Vite proxy."
          persistent-hint
          :error-messages="errors.endpoint"
        />

        <v-text-field
          v-model="form.debugBaseUrl"
          class="mt-3"
          label="Debug API base URL"
          placeholder="http://localhost:5180/debug"
          hint="Used for local Lambda log inspection."
          persistent-hint
          :error-messages="errors.debugBaseUrl"
        />

        <v-text-field
          v-model="form.region"
          class="mt-3"
          label="AWS region"
          placeholder="us-east-1"
          :error-messages="errors.region"
        />
      </v-card-text>

      <v-card-actions>
        <v-btn color="secondary" variant="text" @click="$emit('reset')">Reset defaults</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close(false)">Cancel</v-btn>
        <v-btn color="primary" @click="save">Save and reload</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  settings: { type: Object, required: true },
})

const emit = defineEmits(['update:modelValue', 'save', 'reset'])

const form = reactive({
  endpoint: '',
  debugBaseUrl: '',
  region: '',
})

const errors = reactive({
  endpoint: '',
  debugBaseUrl: '',
  region: '',
})

watch(
  () => [props.modelValue, props.settings],
  () => {
    if (!props.modelValue) return
    form.endpoint = props.settings.endpoint
    form.debugBaseUrl = props.settings.debugBaseUrl
    form.region = props.settings.region
    clearErrors()
  },
  { immediate: true, deep: true },
)

function save() {
  clearErrors()
  errors.endpoint = validateEndpoint(form.endpoint)
  errors.debugBaseUrl = validateEndpoint(form.debugBaseUrl)
  errors.region = form.region.trim() ? '' : 'Region is required.'

  if (errors.endpoint || errors.debugBaseUrl || errors.region) return

  emit('save', {
    endpoint: form.endpoint.trim(),
    debugBaseUrl: form.debugBaseUrl.trim(),
    region: form.region.trim(),
  })
}

function validateEndpoint(value) {
  const trimmed = value.trim()
  if (!trimmed) return 'Endpoint is required.'
  if (trimmed.startsWith('/')) return ''

  try {
    const url = new URL(trimmed)
    return ['http:', 'https:'].includes(url.protocol) ? '' : 'Use an HTTP or HTTPS URL.'
  } catch {
    return 'Use an absolute HTTP(S) URL or a path beginning with /.'
  }
}

function clearErrors() {
  errors.endpoint = ''
  errors.debugBaseUrl = ''
  errors.region = ''
}

function close(value) {
  emit('update:modelValue', value)
}
</script>
