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
  DescribeExecutionCommand,
  DescribeStateMachineCommand,
  GetExecutionHistoryCommand,
  ListStateMachinesCommand,
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn'

const endpoint = import.meta.env.VITE_AWS_BROWSER_ENDPOINT_URL || `${window.location.origin}/floci`
const region = import.meta.env.VITE_AWS_REGION || 'us-east-1'
const stateMachineName =
  import.meta.env.VITE_STEPFUNCTIONS_STATE_MACHINE_NAME ||
  'aws-local-sandbox-stepfunctions-two-lambdas'
const credentials = {
  accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || 'test',
  secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || 'test',
}

const sfn = new SFNClient({
  endpoint,
  region,
  credentials,
})

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
    const listResult = await sfn.send(new ListStateMachinesCommand({ maxResults: 100 }))
    const detected =
      (listResult.stateMachines || []).find((candidate) => candidate.name === stateMachineName) ||
      (listResult.stateMachines || [])[0]

    if (!detected?.stateMachineArn) {
      throw new Error(`No Step Functions state machine was found for ${stateMachineName}.`)
    }

    stateMachine.value = detected
    stateMachineArn.value = detected.stateMachineArn
    const detail = await sfn.send(
      new DescribeStateMachineCommand({
        stateMachineArn: detected.stateMachineArn,
      }),
    )
    stateMachineDetail.value = detail
    stateMachineDefinition.value = parseJson(detail.definition)
    statusMessage.value = `Loaded ${detected.name}.`
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

    const input = JSON.stringify(parseJson(executionInput.value))
    const executionName = `gui-${Date.now()}`
    const startResult = await sfn.send(
      new StartExecutionCommand({
        stateMachineArn: stateMachineArn.value,
        name: executionName,
        input,
      }),
    )

    const described = await waitForExecution(startResult.executionArn)
    execution.value = described
    executionOutput.value = parseJson(described.output)

    const historyResult = await sfn.send(
      new GetExecutionHistoryCommand({
        executionArn: startResult.executionArn,
      }),
    )
    historyEvents.value = historyResult.events || []
    statusMessage.value = `Execution ${executionName} finished with ${described.status}.`
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to start Step Functions execution.')
  } finally {
    starting.value = false
  }
}

async function waitForExecution(executionArn) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await sfn.send(
      new DescribeExecutionCommand({
        executionArn,
      }),
    )

    if (result.status !== 'RUNNING') {
      return result
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return sfn.send(
    new DescribeExecutionCommand({
      executionArn,
    }),
  )
}

function parseJson(value) {
  if (!value) return null
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    return value
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
