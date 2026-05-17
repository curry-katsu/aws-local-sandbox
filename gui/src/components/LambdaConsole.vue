<template>
  <v-sheet border rounded="lg">
    <div class="tool-header">
      <div>
        <h2 class="text-h6">Lambda</h2>
        <p class="text-body-2 text-medium-emphasis ma-0">
          Inspect local functions, invoke handlers, and review published layers.
        </p>
      </div>
      <div class="tool-actions">
        <v-btn
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-refresh"
          :loading="loading"
          @click="refreshActiveTab"
        >
          Refresh
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-play-circle-outline"
          :loading="invoking"
          :disabled="activeTab !== 'functions' || !selectedFunctionName"
          @click="invokeSelectedFunction"
        >
          Invoke
        </v-btn>
      </div>
    </div>

    <v-divider />

    <v-tabs v-model="activeTab" density="comfortable">
      <v-tab value="functions" prepend-icon="mdi-lambda">Functions</v-tab>
      <v-tab value="layers" prepend-icon="mdi-layers-outline">Layers</v-tab>
    </v-tabs>

    <v-divider />

    <div class="tool-body">
      <v-alert v-if="error" type="error" variant="tonal" density="comfortable">
        {{ error }}
      </v-alert>
      <v-alert v-if="statusMessage" type="info" variant="tonal" density="comfortable">
        {{ statusMessage }}
      </v-alert>

      <v-row v-if="activeTab === 'functions'" align="stretch">
        <v-col cols="12" md="4">
          <v-sheet border rounded="lg" class="panel">
            <div class="panel-title">Functions</div>
            <v-list density="compact" nav>
              <v-list-item
                v-if="functions.length === 0"
                title="No functions found"
                subtitle="Run Terraform apply to provision the local Lambda demos."
              />
              <v-list-item
                v-for="item in functions"
                :key="item.FunctionName"
                :active="item.FunctionName === selectedFunctionName"
                :title="item.FunctionName"
                :subtitle="item.Runtime || 'runtime unknown'"
                prepend-icon="mdi-lambda"
                @click="selectFunction(item.FunctionName)"
              />
            </v-list>
          </v-sheet>
        </v-col>

        <v-col cols="12" md="8">
          <div class="detail-stack">
            <div class="summary-grid">
              <div class="summary-cell">
                <div class="text-caption text-medium-emphasis">Function</div>
                <div class="text-body-2 font-weight-medium text-truncate">
                  {{ selectedFunction?.FunctionName || 'Not selected' }}
                </div>
              </div>
              <div class="summary-cell">
                <div class="text-caption text-medium-emphasis">Runtime</div>
                <div class="text-body-2 font-weight-medium">
                  {{ selectedFunction?.Runtime || 'Not loaded' }}
                </div>
              </div>
              <div class="summary-cell">
                <div class="text-caption text-medium-emphasis">Last modified</div>
                <div class="text-body-2 font-weight-medium">
                  {{ selectedFunction?.LastModified || 'Not loaded' }}
                </div>
              </div>
            </div>

            <v-textarea
              v-model="invokePayload"
              label="Invocation payload"
              density="comfortable"
              variant="outlined"
              rows="5"
              hide-details="auto"
            />

            <v-expansion-panels variant="accordion" multiple>
              <v-expansion-panel title="Function configuration">
                <v-expansion-panel-text>
                  <pre>{{ formatJson(functionDetail?.Configuration || selectedFunction || {}) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel title="Code metadata">
                <v-expansion-panel-text>
                  <pre>{{ formatJson(functionDetail?.Code || {}) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel title="Invocation result">
                <v-expansion-panel-text>
                  <pre>{{ formatJson(invokeResult || {}) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
        </v-col>
      </v-row>

      <v-row v-else align="stretch">
        <v-col cols="12" md="4">
          <v-sheet border rounded="lg" class="panel">
            <div class="panel-title">Layers</div>
            <v-list density="compact" nav>
              <v-list-item
                v-if="layers.length === 0"
                title="No layers found"
                subtitle="Floci may not support Lambda Layer publishing yet."
              />
              <v-list-item
                v-for="item in layers"
                :key="item.LayerName"
                :active="item.LayerName === selectedLayerName"
                :title="item.LayerName"
                :subtitle="item.LayerArn || 'ARN unavailable'"
                prepend-icon="mdi-layers-outline"
                @click="selectLayer(item.LayerName)"
              />
            </v-list>
          </v-sheet>
        </v-col>

        <v-col cols="12" md="8">
          <div class="detail-stack">
            <div class="summary-grid">
              <div class="summary-cell">
                <div class="text-caption text-medium-emphasis">Layer</div>
                <div class="text-body-2 font-weight-medium text-truncate">
                  {{ selectedLayer?.LayerName || 'Not selected' }}
                </div>
              </div>
              <div class="summary-cell">
                <div class="text-caption text-medium-emphasis">Latest version</div>
                <div class="text-body-2 font-weight-medium">
                  {{ selectedLayer?.LatestMatchingVersion?.Version || 'Not loaded' }}
                </div>
              </div>
              <div class="summary-cell">
                <div class="text-caption text-medium-emphasis">Versions loaded</div>
                <div class="text-body-2 font-weight-medium">
                  {{ layerVersions.length }}
                </div>
              </div>
            </div>

            <v-sheet border rounded="lg" class="panel compact-panel">
              <div class="panel-title">Versions</div>
              <v-table density="compact">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Runtime</th>
                    <th>Created</th>
                    <th class="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="layerVersions.length === 0">
                    <td colspan="4" class="text-medium-emphasis">No versions loaded.</td>
                  </tr>
                  <tr v-for="version in layerVersions" :key="version.Version">
                    <td>{{ version.Version }}</td>
                    <td>{{ formatRuntimeList(version.CompatibleRuntimes) }}</td>
                    <td>{{ version.CreatedDate || 'Unknown' }}</td>
                    <td class="text-right">
                      <v-btn
                        size="small"
                        variant="text"
                        color="primary"
                        :loading="loadingLayerDetail && selectedLayerVersion === version.Version"
                        @click="loadLayerVersionDetail(selectedLayerName, version.Version)"
                      >
                        Inspect
                      </v-btn>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-sheet>

            <v-expansion-panels variant="accordion" multiple>
              <v-expansion-panel title="Layer metadata">
                <v-expansion-panel-text>
                  <pre>{{ formatJson(selectedLayer || {}) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel title="Layer version detail">
                <v-expansion-panel-text>
                  <pre>{{ formatJson(layerVersionDetail || {}) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
        </v-col>
      </v-row>
    </div>
  </v-sheet>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  getLambdaFunction,
  getLambdaLayerVersion,
  invokeLambdaFunction,
  listLambdaLayerVersions,
  listLambdaLayers,
  listLambdaFunctions,
} from '../aws/lambda'

const activeTab = ref('functions')
const loading = ref(false)
const loadingDetail = ref(false)
const loadingLayerDetail = ref(false)
const invoking = ref(false)
const error = ref('')
const statusMessage = ref('')
const functions = ref([])
const layers = ref([])
const layerVersions = ref([])
const selectedFunctionName = ref('')
const selectedLayerName = ref('')
const selectedLayerVersion = ref(null)
const functionDetail = ref(null)
const layerVersionDetail = ref(null)
const invokeResult = ref(null)
const invokePayload = ref(JSON.stringify({
  source: 'gui',
  message: 'hello from Lambda dashboard',
}, null, 2))

const selectedFunction = computed(() =>
  functions.value.find((candidate) => candidate.FunctionName === selectedFunctionName.value) || null,
)

const selectedLayer = computed(() =>
  layers.value.find((candidate) => candidate.LayerName === selectedLayerName.value) || null,
)

async function refreshActiveTab() {
  if (activeTab.value === 'layers') {
    await loadLayers()
    return
  }

  await loadFunctions()
}

async function loadFunctions() {
  loading.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    functions.value = await listLambdaFunctions()

    if (!selectedFunctionName.value && functions.value.length > 0) {
      selectedFunctionName.value = functions.value[0].FunctionName
    }

    if (selectedFunctionName.value) {
      await loadFunctionDetail(selectedFunctionName.value)
    }

    statusMessage.value = `Loaded ${functions.value.length} Lambda function(s).`
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load Lambda functions.')
  } finally {
    loading.value = false
  }
}

async function loadLayers() {
  loading.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    layers.value = await listLambdaLayers()

    if (!selectedLayerName.value && layers.value.length > 0) {
      selectedLayerName.value = layers.value[0].LayerName
    }

    if (selectedLayerName.value) {
      await loadLayerVersions(selectedLayerName.value)
    }

    statusMessage.value = `Loaded ${layers.value.length} Lambda layer(s).`
  } catch (caught) {
    layers.value = []
    layerVersions.value = []
    layerVersionDetail.value = null
    error.value = messageFromError(caught, 'Failed to load Lambda layers.')
  } finally {
    loading.value = false
  }
}

async function selectFunction(functionName) {
  selectedFunctionName.value = functionName
  invokeResult.value = null
  await loadFunctionDetail(functionName)
}

async function loadFunctionDetail(functionName) {
  loadingDetail.value = true
  error.value = ''

  try {
    functionDetail.value = await getLambdaFunction(functionName)
  } catch (caught) {
    functionDetail.value = null
    error.value = messageFromError(caught, 'Failed to load Lambda function details.')
  } finally {
    loadingDetail.value = false
  }
}

async function selectLayer(layerName) {
  selectedLayerName.value = layerName
  selectedLayerVersion.value = null
  layerVersionDetail.value = null
  await loadLayerVersions(layerName)
}

async function loadLayerVersions(layerName) {
  loadingDetail.value = true
  error.value = ''

  try {
    layerVersions.value = await listLambdaLayerVersions(layerName)
  } catch (caught) {
    layerVersions.value = []
    error.value = messageFromError(caught, 'Failed to load Lambda layer versions.')
  } finally {
    loadingDetail.value = false
  }
}

async function loadLayerVersionDetail(layerName, versionNumber) {
  if (!layerName || !versionNumber) return

  loadingLayerDetail.value = true
  selectedLayerVersion.value = versionNumber
  error.value = ''

  try {
    layerVersionDetail.value = await getLambdaLayerVersion(layerName, versionNumber)
  } catch (caught) {
    layerVersionDetail.value = null
    error.value = messageFromError(caught, 'Failed to load Lambda layer version details.')
  } finally {
    loadingLayerDetail.value = false
  }
}

async function invokeSelectedFunction() {
  invoking.value = true
  error.value = ''
  statusMessage.value = ''
  invokeResult.value = null

  try {
    invokeResult.value = await invokeLambdaFunction(selectedFunctionName.value, invokePayload.value)
    statusMessage.value = `Invoked ${selectedFunctionName.value}.`
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to invoke Lambda function.')
  } finally {
    invoking.value = false
  }
}

function formatJson(value) {
  return JSON.stringify(value, null, 2)
}

function formatRuntimeList(value) {
  if (!value || value.length === 0) return 'Any'
  return value.join(', ')
}

function messageFromError(caught, fallback) {
  if (caught instanceof Error && caught.message) return caught.message
  return fallback
}

onMounted(loadFunctions)

watch(activeTab, async (nextTab) => {
  error.value = ''
  statusMessage.value = ''

  if (nextTab === 'layers' && layers.value.length === 0) {
    await loadLayers()
  }
})
</script>

<style scoped>
.tool-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 16px;
}

.tool-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.tool-body {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.panel {
  height: 100%;
  min-height: 360px;
  overflow: hidden;
}

.compact-panel {
  height: auto;
  min-height: 0;
}

.panel-title {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  font-size: 0.875rem;
  font-weight: 600;
  padding: 12px 16px;
}

.detail-stack {
  display: grid;
  gap: 16px;
}

.summary-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.summary-cell {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  min-width: 0;
  padding: 12px;
}

pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  margin: 0;
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
}

@media (max-width: 960px) {
  .tool-header {
    align-items: stretch;
    flex-direction: column;
  }

  .tool-actions {
    justify-content: stretch;
  }

  .tool-actions :deep(.v-btn) {
    flex: 1 1 150px;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
