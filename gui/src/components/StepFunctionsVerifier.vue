<template>
  <v-sheet border rounded="lg">
    <div class="tool-header">
      <div>
        <h2 class="text-h6">Step Functions</h2>
        <p class="text-body-2 text-medium-emphasis ma-0">
          Start the two-Lambda state machine and inspect the execution result.
        </p>
      </div>
      <div class="tool-actions">
        <v-btn
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-transit-connection-variant"
          :loading="loading"
          @click="loadStateMachine"
        >
          Detect
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-play-circle-outline"
          :loading="starting"
          :disabled="!stateMachineArn"
          @click="startExecution"
        >
          Start
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

      <div class="summary-grid">
        <div class="summary-cell">
          <div class="text-caption text-medium-emphasis">State machine</div>
          <div class="text-body-2 font-weight-medium">{{ stateMachine?.name || stateMachineName }}</div>
        </div>
        <div class="summary-cell">
          <div class="text-caption text-medium-emphasis">Status</div>
          <div class="text-body-2 font-weight-medium">{{ stateMachineDetail?.status || 'Not loaded' }}</div>
        </div>
        <div class="summary-cell">
          <div class="text-caption text-medium-emphasis">Last execution</div>
          <div class="text-body-2 font-weight-medium">{{ execution?.status || 'Not started' }}</div>
        </div>
      </div>

      <v-textarea
        v-model="executionInput"
        label="Execution input"
        density="comfortable"
        variant="outlined"
        rows="4"
        hide-details="auto"
      />

      <v-expansion-panels variant="accordion" multiple>
        <v-expansion-panel title="State machine definition">
          <v-expansion-panel-text>
            <pre>{{ formatJson(stateMachineDefinition) }}</pre>
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel title="Execution output">
          <v-expansion-panel-text>
            <pre>{{ formatJson(executionOutput) }}</pre>
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel title="Execution history">
          <v-expansion-panel-text>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="historyEvents.length === 0">
                  <td colspan="3" class="text-medium-emphasis">No execution history loaded.</td>
                </tr>
                <tr v-for="event in historyEvents" :key="event.id">
                  <td>{{ event.id }}</td>
                  <td>{{ event.type }}</td>
                  <td>{{ formatDate(event.timestamp) }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>
  </v-sheet>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import {
  defaultStateMachineName,
  loadStateMachineByName,
  startStateMachineExecution,
} from '../aws/stepfunctions'

const stateMachineName = defaultStateMachineName

const loading = ref(false)
const starting = ref(false)
const error = ref('')
const statusMessage = ref('')
const stateMachine = ref(null)
const stateMachineDetail = ref(null)
const stateMachineArn = ref('')
const stateMachineDefinition = ref(null)
const execution = ref(null)
const executionOutput = ref(null)
const historyEvents = ref([])
const executionInput = ref(JSON.stringify({
  source: 'gui',
  message: 'hello from GUI Step Functions',
}, null, 2))

async function loadStateMachine() {
  loading.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const result = await loadStateMachineByName(stateMachineName)
    stateMachine.value = result.stateMachine
    stateMachineArn.value = result.stateMachineArn
    stateMachineDetail.value = result.detail
    stateMachineDefinition.value = result.definition
    statusMessage.value = `Loaded ${result.stateMachine.name}.`
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load Step Functions state machine.')
  } finally {
    loading.value = false
  }
}

async function startExecution() {
  starting.value = true
  error.value = ''
  statusMessage.value = ''
  execution.value = null
  executionOutput.value = null
  historyEvents.value = []

  try {
    if (!stateMachineArn.value) {
      await loadStateMachine()
    }

    const result = await startStateMachineExecution(stateMachineArn.value, executionInput.value)
    execution.value = result.execution
    executionOutput.value = result.output
    historyEvents.value = result.historyEvents
    statusMessage.value = `Execution ${result.executionName} finished with ${result.execution.status}.`
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to start Step Functions execution.')
  } finally {
    starting.value = false
  }
}

function formatJson(value) {
  if (!value) return '{}'
  return JSON.stringify(value, null, 2)
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

function messageFromError(caught, fallback) {
  if (caught instanceof Error && caught.message) return caught.message
  return fallback
}

onMounted(loadStateMachine)
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
