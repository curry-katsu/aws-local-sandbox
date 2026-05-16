<template>
  <v-sheet border rounded="lg">
    <div class="tool-header">
      <div>
        <h2 class="text-h6">Lambda</h2>
        <p class="text-body-2 text-medium-emphasis ma-0">
          Inspect local functions and run a request-response invocation.
        </p>
      </div>
      <div class="tool-actions">
        <v-btn
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-refresh"
          :loading="loading"
          @click="loadFunctions"
        >
          Refresh
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-play-circle-outline"
          :loading="invoking"
          :disabled="!selectedFunctionName"
          @click="invokeSelectedFunction"
        >
          Invoke
        </v-btn>
      </div>
    </div>

    <v-divider />

    <div class="tool-body">
      <v-alert v-if="error" type="error" variant="tonal" density="comfortable">
        {{ error }}
      </v-alert>
      <v-alert v-if="statusMessage" type="info" variant="tonal" density="comfortable">
        {{ statusMessage }}
      </v-alert>

      <v-row align="stretch">
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
    </div>
  </v-sheet>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  getLambdaFunction,
  invokeLambdaFunction,
  listLambdaFunctions,
} from '../aws/lambda'

const loading = ref(false)
const loadingDetail = ref(false)
const invoking = ref(false)
const error = ref('')
const statusMessage = ref('')
const functions = ref([])
const selectedFunctionName = ref('')
const functionDetail = ref(null)
const invokeResult = ref(null)
const invokePayload = ref(JSON.stringify({
  source: 'gui',
  message: 'hello from Lambda dashboard',
}, null, 2))

const selectedFunction = computed(() =>
  functions.value.find((candidate) => candidate.FunctionName === selectedFunctionName.value) || null,
)

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

function messageFromError(caught, fallback) {
  if (caught instanceof Error && caught.message) return caught.message
  return fallback
}

onMounted(loadFunctions)
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
