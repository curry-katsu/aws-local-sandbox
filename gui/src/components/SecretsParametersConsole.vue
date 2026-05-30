<template>
  <div class="service-console">
    <v-sheet border rounded="lg" class="side-panel">
      <div class="panel-header">
        <div>
          <h2 class="text-h6">Secrets & parameters</h2>
          <p class="text-body-2 text-medium-emphasis ma-0">
            Inspect and edit local secret values and configuration parameters.
          </p>
        </div>
        <v-btn variant="tonal" icon="mdi-refresh" :loading="loadingList" @click="loadResources" />
      </div>

      <v-tabs v-model="resourceType" density="comfortable" grow>
        <v-tab value="secret">Secrets</v-tab>
        <v-tab value="parameter">Parameters</v-tab>
      </v-tabs>

      <v-alert v-if="error" class="mx-4 my-4" type="error" variant="tonal" density="comfortable">
        {{ error }}
      </v-alert>
      <v-alert
        v-if="statusMessage"
        class="mx-4 my-4"
        type="info"
        variant="tonal"
        density="comfortable"
      >
        {{ statusMessage }}
      </v-alert>

      <div class="list-actions">
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          block
          @click="resourceType === 'secret' ? openCreateSecret() : openCreateParameter()"
        >
          {{ resourceType === 'secret' ? 'New secret' : 'New parameter' }}
        </v-btn>
      </div>

      <v-window v-model="resourceType">
        <v-window-item value="secret">
          <v-list density="compact" nav>
            <v-list-item
              v-if="!loadingList && secrets.length === 0"
              title="No secrets found"
              subtitle="Run Terraform apply or create one here."
            />
            <v-list-item
              v-for="secret in secrets"
              :key="secret.arn || secret.name"
              :active="selectedSecretId === secret.name && mode !== 'create-secret'"
              prepend-icon="mdi-key-variant"
              :title="secret.name"
              :subtitle="secret.description || secret.arn"
              @click="selectSecret(secret.name)"
            />
          </v-list>
        </v-window-item>

        <v-window-item value="parameter">
          <v-list density="compact" nav>
            <v-list-item
              v-if="!loadingList && parameters.length === 0"
              title="No parameters found"
              subtitle="Run Terraform apply or create one here."
            />
            <v-list-item
              v-for="parameter in parameters"
              :key="parameter.name"
              :active="selectedParameterName === parameter.name && mode !== 'create-parameter'"
              prepend-icon="mdi-tune-variant"
              :title="parameter.name"
              :subtitle="`${parameter.type || 'Unknown'} · version ${parameter.version || 0}`"
              @click="selectParameter(parameter.name)"
            />
          </v-list>
        </v-window-item>
      </v-window>
    </v-sheet>

    <v-sheet border rounded="lg" class="main-panel">
      <div class="panel-header">
        <div>
          <h2 class="text-h6">{{ panelTitle }}</h2>
          <p class="text-body-2 text-medium-emphasis ma-0">{{ panelSubtitle }}</p>
        </div>
        <div class="panel-actions">
          <v-btn
            v-if="selectedSecretId && mode === 'secret-detail'"
            variant="tonal"
            prepend-icon="mdi-refresh"
            :loading="loadingValue"
            @click="loadSelectedSecretValue"
          >
            Reload
          </v-btn>
          <v-btn
            v-if="selectedParameterName && mode === 'parameter-detail'"
            variant="tonal"
            prepend-icon="mdi-refresh"
            :loading="loadingValue"
            @click="loadSelectedParameterValue"
          >
            Reload
          </v-btn>
          <v-btn
            v-if="selectedSecretId && mode === 'secret-detail'"
            color="error"
            variant="tonal"
            prepend-icon="mdi-delete-outline"
            @click="deleteSecretDialog = true"
          >
            Delete
          </v-btn>
          <v-btn
            v-if="selectedParameterName && mode === 'parameter-detail'"
            color="error"
            variant="tonal"
            prepend-icon="mdi-delete-outline"
            @click="deleteParameterDialog = true"
          >
            Delete
          </v-btn>
        </div>
      </div>

      <v-divider />

      <div v-if="mode === 'empty'" class="empty-state">
        <v-icon icon="mdi-shield-key-outline" size="44" />
        <div class="text-body-1 font-weight-medium">Choose a resource</div>
        <div class="text-body-2 text-medium-emphasis">
          Secret and parameter values appear here after selection.
        </div>
      </div>

      <div v-else-if="mode === 'create-secret'" class="editor-panel">
        <v-text-field
          v-model="secretForm.name"
          label="Secret name"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
        <v-text-field
          v-model="secretForm.description"
          label="Description"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
        <v-textarea
          v-model="secretForm.secretString"
          label="Secret string"
          density="comfortable"
          variant="outlined"
          rows="12"
          hide-details="auto"
          class="mono-input"
        />
        <div class="editor-actions">
          <v-btn variant="text" @click="cancelCreate">Cancel</v-btn>
          <v-btn color="primary" prepend-icon="mdi-plus" :loading="saving" @click="createSecretFromForm">
            Create secret
          </v-btn>
        </div>
      </div>

      <div v-else-if="mode === 'create-parameter'" class="editor-panel">
        <v-text-field
          v-model="parameterForm.name"
          label="Parameter name"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
        <v-select
          v-model="parameterForm.type"
          :items="parameterTypes"
          label="Type"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
        <v-text-field
          v-model="parameterForm.description"
          label="Description"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
        <v-textarea
          v-model="parameterForm.value"
          label="Value"
          density="comfortable"
          variant="outlined"
          rows="10"
          hide-details="auto"
          class="mono-input"
        />
        <div class="editor-actions">
          <v-btn variant="text" @click="cancelCreate">Cancel</v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            :loading="saving"
            @click="createParameterFromForm"
          >
            Create parameter
          </v-btn>
        </div>
      </div>

      <template v-else-if="mode === 'secret-detail'">
        <div class="summary-grid">
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">Name</div>
            <div class="text-body-2 font-weight-medium mono">{{ selectedSecret?.name }}</div>
          </div>
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">Version</div>
            <div class="text-body-2 font-weight-medium mono">{{ secretValue.versionId || '-' }}</div>
          </div>
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">Stages</div>
            <div class="text-body-2 font-weight-medium">{{ secretValue.versionStages.join(', ') || '-' }}</div>
          </div>
        </div>

        <div class="editor-panel">
          <v-textarea
            v-model="secretValue.secretString"
            label="Secret string"
            density="comfortable"
            variant="outlined"
            rows="16"
            hide-details="auto"
            class="mono-input"
          />
          <div class="editor-actions">
            <v-btn variant="tonal" prepend-icon="mdi-code-json" @click="formatSecretJson">
              Format JSON
            </v-btn>
            <v-btn
              color="primary"
              prepend-icon="mdi-content-save-outline"
              :loading="saving"
              @click="saveSecretValue"
            >
              Save new version
            </v-btn>
          </div>
        </div>
      </template>

      <template v-else-if="mode === 'parameter-detail'">
        <div class="summary-grid">
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">Name</div>
            <div class="text-body-2 font-weight-medium mono">{{ parameterValue.name }}</div>
          </div>
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">Type</div>
            <div class="text-body-2 font-weight-medium">{{ parameterValue.type }}</div>
          </div>
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">Version</div>
            <div class="text-body-2 font-weight-medium">{{ parameterValue.version || 0 }}</div>
          </div>
        </div>

        <div class="editor-panel">
          <v-select
            v-model="parameterForm.type"
            :items="parameterTypes"
            label="Type"
            density="comfortable"
            variant="outlined"
            hide-details="auto"
          />
          <v-textarea
            v-model="parameterForm.value"
            label="Value"
            density="comfortable"
            variant="outlined"
            rows="14"
            hide-details="auto"
            class="mono-input"
          />
          <div class="editor-actions">
            <v-btn
              color="primary"
              prepend-icon="mdi-content-save-outline"
              :loading="saving"
              @click="saveParameterValue"
            >
              Save parameter
            </v-btn>
          </div>
        </div>
      </template>
    </v-sheet>

    <v-dialog v-model="deleteSecretDialog" max-width="520">
      <v-card>
        <v-card-title>Delete secret</v-card-title>
        <v-card-text>
          Delete <strong>{{ selectedSecretId }}</strong> from local Secrets Manager. This uses force
          delete without a recovery window.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteSecretDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="deleteSelectedSecret">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteParameterDialog" max-width="520">
      <v-card>
        <v-card-title>Delete parameter</v-card-title>
        <v-card-text>
          Delete <strong>{{ selectedParameterName }}</strong> from local Parameter Store.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteParameterDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="deleteSelectedParameter">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  createSecret,
  deleteParameter,
  deleteSecret,
  getParameterValue,
  getSecretValue,
  listParameters,
  listSecrets,
  putParameter,
  putSecretValue,
} from '../aws/secrets'

const parameterTypes = ['String', 'StringList', 'SecureString']
const resourceType = ref('secret')
const secrets = ref([])
const parameters = ref([])
const selectedSecretId = ref('')
const selectedParameterName = ref('')
const mode = ref('empty')
const loadingList = ref(false)
const loadingValue = ref(false)
const saving = ref(false)
const deleting = ref(false)
const error = ref('')
const statusMessage = ref('')
const deleteSecretDialog = ref(false)
const deleteParameterDialog = ref(false)
const secretValue = reactive({
  secretString: '',
  versionId: '',
  versionStages: [],
})
const parameterValue = reactive({
  name: '',
  type: '',
  value: '',
  version: 0,
})
const secretForm = reactive({
  name: '',
  description: '',
  secretString: '',
})
const parameterForm = reactive({
  name: '',
  description: '',
  type: 'String',
  value: '',
})

const selectedSecret = computed(() =>
  secrets.value.find((secret) => secret.name === selectedSecretId.value),
)
const panelTitle = computed(() => {
  if (mode.value === 'create-secret') return 'Create secret'
  if (mode.value === 'create-parameter') return 'Create parameter'
  if (mode.value === 'secret-detail') return selectedSecretId.value
  if (mode.value === 'parameter-detail') return selectedParameterName.value
  return 'Select a resource'
})
const panelSubtitle = computed(() => {
  if (mode.value === 'secret-detail') return selectedSecret.value?.arn || 'Secrets Manager value'
  if (mode.value === 'parameter-detail') return 'SSM Parameter Store value'
  if (mode.value.startsWith('create')) return 'Create a local resource through Floci.'
  return 'Choose an item from the left panel.'
})

watch(resourceType, () => {
  error.value = ''
  statusMessage.value = ''
  if (resourceType.value === 'secret' && selectedSecretId.value) {
    mode.value = 'secret-detail'
  } else if (resourceType.value === 'parameter' && selectedParameterName.value) {
    mode.value = 'parameter-detail'
  } else {
    mode.value = 'empty'
  }
})

async function loadResources() {
  loadingList.value = true
  error.value = ''

  try {
    const [loadedSecrets, loadedParameters] = await Promise.all([listSecrets(), listParameters()])
    secrets.value = loadedSecrets
    parameters.value = loadedParameters
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load secrets and parameters.')
  } finally {
    loadingList.value = false
  }
}

async function selectSecret(secretId) {
  selectedSecretId.value = secretId
  resourceType.value = 'secret'
  mode.value = 'secret-detail'
  await loadSelectedSecretValue()
}

async function selectParameter(name) {
  selectedParameterName.value = name
  resourceType.value = 'parameter'
  mode.value = 'parameter-detail'
  await loadSelectedParameterValue()
}

async function loadSelectedSecretValue() {
  if (!selectedSecretId.value) return
  loadingValue.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const value = await getSecretValue(selectedSecretId.value)
    secretValue.secretString = value.secretString
    secretValue.versionId = value.versionId
    secretValue.versionStages = value.versionStages
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load secret value.')
  } finally {
    loadingValue.value = false
  }
}

async function loadSelectedParameterValue() {
  if (!selectedParameterName.value) return
  loadingValue.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const value = await getParameterValue(selectedParameterName.value, true)
    parameterValue.name = value.name
    parameterValue.type = value.type
    parameterValue.value = value.value
    parameterValue.version = value.version
    parameterForm.name = value.name
    parameterForm.type = value.type || 'String'
    parameterForm.value = value.value
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load parameter value.')
  } finally {
    loadingValue.value = false
  }
}

function openCreateSecret() {
  resourceType.value = 'secret'
  mode.value = 'create-secret'
  error.value = ''
  statusMessage.value = ''
  secretForm.name = nextSecretName()
  secretForm.description = 'Created from local GUI.'
  secretForm.secretString = JSON.stringify({ source: 'gui', value: 'sample-secret' }, null, 2)
}

function openCreateParameter() {
  resourceType.value = 'parameter'
  mode.value = 'create-parameter'
  error.value = ''
  statusMessage.value = ''
  parameterForm.name = nextParameterName()
  parameterForm.description = 'Created from local GUI.'
  parameterForm.type = 'String'
  parameterForm.value = 'sample-parameter-value'
}

function cancelCreate() {
  if (resourceType.value === 'secret' && selectedSecretId.value) {
    mode.value = 'secret-detail'
  } else if (resourceType.value === 'parameter' && selectedParameterName.value) {
    mode.value = 'parameter-detail'
  } else {
    mode.value = 'empty'
  }
}

async function createSecretFromForm() {
  if (!secretForm.name.trim()) {
    error.value = 'Secret name is required.'
    return
  }

  saving.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    await createSecret({
      name: secretForm.name.trim(),
      description: secretForm.description.trim(),
      secretString: secretForm.secretString,
    })
    statusMessage.value = `Created ${secretForm.name.trim()}.`
    await loadResources()
    await selectSecret(secretForm.name.trim())
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to create secret.')
  } finally {
    saving.value = false
  }
}

async function createParameterFromForm() {
  if (!parameterForm.name.trim()) {
    error.value = 'Parameter name is required.'
    return
  }

  saving.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    await putParameter({
      name: parameterForm.name.trim(),
      description: parameterForm.description.trim(),
      type: parameterForm.type,
      value: parameterForm.value,
      overwrite: false,
    })
    statusMessage.value = `Created ${parameterForm.name.trim()}.`
    await loadResources()
    await selectParameter(parameterForm.name.trim())
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to create parameter.')
  } finally {
    saving.value = false
  }
}

async function saveSecretValue() {
  if (!selectedSecretId.value) return
  saving.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const versionId = await putSecretValue(selectedSecretId.value, secretValue.secretString)
    statusMessage.value = `Saved new secret version ${versionId}.`
    await loadSelectedSecretValue()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to save secret value.')
  } finally {
    saving.value = false
  }
}

async function saveParameterValue() {
  if (!selectedParameterName.value) return
  saving.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const version = await putParameter({
      name: selectedParameterName.value,
      type: parameterForm.type,
      value: parameterForm.value,
      overwrite: true,
    })
    statusMessage.value = `Saved parameter version ${version}.`
    await loadResources()
    await loadSelectedParameterValue()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to save parameter value.')
  } finally {
    saving.value = false
  }
}

async function deleteSelectedSecret() {
  if (!selectedSecretId.value) return
  deleting.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const deletedName = selectedSecretId.value
    await deleteSecret(selectedSecretId.value)
    deleteSecretDialog.value = false
    selectedSecretId.value = ''
    mode.value = 'empty'
    statusMessage.value = `Deleted ${deletedName}.`
    await loadResources()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to delete secret.')
  } finally {
    deleting.value = false
  }
}

async function deleteSelectedParameter() {
  if (!selectedParameterName.value) return
  deleting.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const deletedName = selectedParameterName.value
    await deleteParameter(selectedParameterName.value)
    deleteParameterDialog.value = false
    selectedParameterName.value = ''
    mode.value = 'empty'
    statusMessage.value = `Deleted ${deletedName}.`
    await loadResources()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to delete parameter.')
  } finally {
    deleting.value = false
  }
}

function formatSecretJson() {
  try {
    secretValue.secretString = JSON.stringify(JSON.parse(secretValue.secretString), null, 2)
  } catch {
    error.value = 'Secret string is not valid JSON.'
  }
}

function nextSecretName() {
  const baseName = 'aws-local-sandbox/gui-secret'
  if (!secrets.value.some((secret) => secret.name === baseName)) return baseName

  let index = 2
  while (secrets.value.some((secret) => secret.name === `${baseName}-${index}`)) {
    index += 1
  }
  return `${baseName}-${index}`
}

function nextParameterName() {
  const baseName = '/aws-local-sandbox/gui/parameter'
  if (!parameters.value.some((parameter) => parameter.name === baseName)) return baseName

  let index = 2
  while (parameters.value.some((parameter) => parameter.name === `${baseName}-${index}`)) {
    index += 1
  }
  return `${baseName}-${index}`
}

function messageFromError(caught, fallback) {
  if (caught instanceof Error && caught.message) return caught.message
  return fallback
}

onMounted(loadResources)
</script>

<style scoped>
.service-console {
  align-items: start;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
}

.side-panel,
.main-panel {
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
.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.list-actions,
.editor-panel {
  padding: 16px;
}

.editor-panel {
  display: grid;
  gap: 12px;
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

.mono,
.mono-input :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}

@media (max-width: 1100px) {
  .service-console {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .panel-header {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
