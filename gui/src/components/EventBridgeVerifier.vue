<template>
  <v-sheet border rounded="lg">
    <div class="tool-header">
      <div>
        <h2 class="text-h6">EventBridge</h2>
        <p class="text-body-2 text-medium-emphasis ma-0">
          Inspect the daily noon JST rule and invoke its Lambda target.
        </p>
      </div>
      <div class="tool-actions">
        <v-btn
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-calendar-search"
          :loading="loading"
          @click="loadRule"
        >
          Refresh
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-play-circle-outline"
          :loading="invoking"
          :disabled="!lambdaTargetArn"
          @click="invokeTargetLambda"
        >
          Invoke Lambda
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
          <div class="text-caption text-medium-emphasis">Rule</div>
          <div class="text-body-2 font-weight-medium">{{ rule?.Name || ruleName }}</div>
        </div>
        <div class="summary-cell">
          <div class="text-caption text-medium-emphasis">Schedule</div>
          <div class="text-body-2 font-weight-medium">
            {{ rule?.ScheduleExpression || 'Not loaded' }}
          </div>
        </div>
        <div class="summary-cell">
          <div class="text-caption text-medium-emphasis">State</div>
          <div class="text-body-2 font-weight-medium">{{ rule?.State || 'Not loaded' }}</div>
        </div>
      </div>

      <v-table density="compact">
        <thead>
          <tr>
            <th>Target ID</th>
            <th>ARN</th>
            <th>Input</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="targets.length === 0">
            <td colspan="3" class="text-medium-emphasis">No targets loaded.</td>
          </tr>
          <tr v-for="target in targets" :key="target.Id">
            <td>{{ target.Id }}</td>
            <td class="mono">{{ target.Arn }}</td>
            <td class="mono">{{ target.Input || '{}' }}</td>
          </tr>
        </tbody>
      </v-table>

      <v-expansion-panels v-if="invokeResult" variant="accordion">
        <v-expansion-panel title="Lambda invoke result">
          <v-expansion-panel-text>
            <pre>{{ formatJson(invokeResult) }}</pre>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>
  </v-sheet>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  EventBridgeClient,
  ListRulesCommand,
  ListTargetsByRuleCommand,
} from '@aws-sdk/client-eventbridge'
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'

const endpoint = import.meta.env.VITE_AWS_BROWSER_ENDPOINT_URL || `${window.location.origin}/floci`
const region = import.meta.env.VITE_AWS_REGION || 'us-east-1'
const ruleName =
  import.meta.env.VITE_EVENTBRIDGE_RULE_NAME || 'aws-local-sandbox-daily-noon-jst'
const credentials = {
  accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || 'test',
  secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || 'test',
}

const clientConfig = {
  endpoint,
  region,
  credentials,
}

const eventbridge = new EventBridgeClient(clientConfig)
const lambda = new LambdaClient(clientConfig)

const loading = ref(false)
const invoking = ref(false)
const error = ref('')
const statusMessage = ref('')
const rule = ref(null)
const targets = ref([])
const invokeResult = ref(null)

const lambdaTargetArn = computed(() => {
  const target = targets.value.find((candidate) => candidate.Arn?.includes(':function:'))
  return target?.Arn || ''
})

async function loadRule() {
  loading.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const rulesResult = await eventbridge.send(
      new ListRulesCommand({
        NamePrefix: ruleName,
        Limit: 20,
      }),
    )
    const detectedRule =
      (rulesResult.Rules || []).find((candidate) => candidate.Name === ruleName) ||
      (rulesResult.Rules || [])[0]

    if (!detectedRule?.Name) {
      throw new Error(`No EventBridge rule was found for ${ruleName}.`)
    }

    rule.value = detectedRule
    const targetResult = await eventbridge.send(
      new ListTargetsByRuleCommand({
        Rule: detectedRule.Name,
      }),
    )
    targets.value = targetResult.Targets || []
    statusMessage.value = `Loaded ${detectedRule.Name} with ${targets.value.length} target(s).`
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load EventBridge rule.')
  } finally {
    loading.value = false
  }
}

async function invokeTargetLambda() {
  invoking.value = true
  error.value = ''
  statusMessage.value = ''
  invokeResult.value = null

  try {
    if (!lambdaTargetArn.value) {
      await loadRule()
    }

    const functionName = lambdaTargetArn.value.split(':function:')[1]
    if (!functionName) {
      throw new Error('No Lambda target ARN was found on the EventBridge rule.')
    }

    const result = await lambda.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(
          JSON.stringify({
            source: 'gui-verification',
            detail: {
              trigger: 'EventBridgeVerifier',
            },
          }),
        ),
      }),
    )

    const payloadText = result.Payload ? new TextDecoder().decode(result.Payload) : ''
    invokeResult.value = {
      statusCode: result.StatusCode,
      executedVersion: result.ExecutedVersion,
      functionError: result.FunctionError,
      payload: parseJson(payloadText),
    }
    statusMessage.value = `Invoked ${functionName}.`
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to invoke Lambda target.')
  } finally {
    invoking.value = false
  }
}

function parseJson(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function formatJson(value) {
  return JSON.stringify(value, null, 2)
}

function messageFromError(caught, fallback) {
  if (caught instanceof Error && caught.message) return caught.message
  return fallback
}

onMounted(loadRule)
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

.mono,
pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}

pre {
  margin: 0;
  max-height: 320px;
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
