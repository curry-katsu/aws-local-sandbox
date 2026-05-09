<template>
  <v-sheet border rounded="lg">
    <div class="resource-header">
      <div>
        <h2 class="text-h6">Resources</h2>
        <p class="text-body-2 text-medium-emphasis ma-0">
          S3, DynamoDB, SQS, SNS, Cognito, EventBridge, and Step Functions resources discovered through AWS SDK v3.
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="loadResources"
      >
        Refresh
      </v-btn>
    </div>

    <v-alert
      v-if="error"
      class="mx-4 mb-4"
      type="error"
      variant="tonal"
      density="comfortable"
    >
      {{ error }}
    </v-alert>

    <v-table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Name</th>
          <th>Identifier</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!loading && resources.length === 0">
          <td colspan="3" class="text-medium-emphasis">No resources found.</td>
        </tr>
        <tr v-for="resource in resources" :key="`${resource.service}:${resource.id}`">
          <td>
            <v-chip size="small" variant="tonal">{{ resource.service }}</v-chip>
          </td>
          <td>{{ resource.name }}</td>
          <td class="resource-id">{{ resource.id }}</td>
        </tr>
      </tbody>
    </v-table>
  </v-sheet>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { EventBridgeClient, ListRulesCommand } from '@aws-sdk/client-eventbridge'
import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import { ListStateMachinesCommand, SFNClient } from '@aws-sdk/client-sfn'
import { ListTopicsCommand, SNSClient } from '@aws-sdk/client-sns'
import { ListQueuesCommand, SQSClient } from '@aws-sdk/client-sqs'
import {
  CognitoIdentityProviderClient,
  ListUserPoolClientsCommand,
  ListUserPoolsCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const endpoint = import.meta.env.VITE_AWS_BROWSER_ENDPOINT_URL || `${window.location.origin}/floci`
const region = import.meta.env.VITE_AWS_REGION || 'us-east-1'
const credentials = {
  accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || 'test',
  secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || 'test',
}

const clientConfig = {
  endpoint,
  region,
  credentials,
  forcePathStyle: true,
}

const s3 = new S3Client(clientConfig)
const dynamodb = new DynamoDBClient(clientConfig)
const sqs = new SQSClient(clientConfig)
const sns = new SNSClient(clientConfig)
const cognito = new CognitoIdentityProviderClient(clientConfig)
const eventbridge = new EventBridgeClient(clientConfig)
const sfn = new SFNClient(clientConfig)

const loading = ref(false)
const error = ref('')
const resources = ref([])

async function loadResources() {
  loading.value = true
  error.value = ''

  try {
    const [
      bucketOutcome,
      tableOutcome,
      queueOutcome,
      topicOutcome,
      userPoolOutcome,
      ruleOutcome,
      stateMachineOutcome,
    ] = await Promise.allSettled([
      s3.send(new ListBucketsCommand({})),
      dynamodb.send(new ListTablesCommand({})),
      sqs.send(new ListQueuesCommand({})),
      sns.send(new ListTopicsCommand({})),
      cognito.send(new ListUserPoolsCommand({ MaxResults: 60 })),
      eventbridge.send(new ListRulesCommand({ Limit: 100 })),
      sfn.send(new ListStateMachinesCommand({ maxResults: 100 })),
    ])

    const failedServices = []
    const resultOrDefault = (service, outcome, fallback) => {
      if (outcome.status === 'fulfilled') {
        return outcome.value
      }

      failedServices.push(service)
      return fallback
    }

    const bucketResult = resultOrDefault('S3', bucketOutcome, { Buckets: [] })
    const tableResult = resultOrDefault('DynamoDB', tableOutcome, { TableNames: [] })
    const queueResult = resultOrDefault('SQS', queueOutcome, { QueueUrls: [] })
    const topicResult = resultOrDefault('SNS', topicOutcome, { Topics: [] })
    const userPoolResult = resultOrDefault('Cognito', userPoolOutcome, { UserPools: [] })
    const ruleResult = resultOrDefault('EventBridge', ruleOutcome, { Rules: [] })
    const stateMachineResult = resultOrDefault('Step Functions', stateMachineOutcome, {
      stateMachines: [],
    })

    const buckets = (bucketResult.Buckets || []).map((bucket) => ({
      service: 'S3',
      name: bucket.Name,
      id: bucket.Name,
    }))

    const tables = (tableResult.TableNames || []).map((tableName) => ({
      service: 'DynamoDB',
      name: tableName,
      id: tableName,
    }))

    const queues = (queueResult.QueueUrls || []).map((queueUrl) => ({
      service: 'SQS',
      name: queueUrl.split('/').pop(),
      id: queueUrl,
    }))

    const topics = (topicResult.Topics || []).map((topic) => ({
      service: 'SNS',
      name: topic.TopicArn.split(':').pop(),
      id: topic.TopicArn,
    }))

    const userPools = await Promise.all(
      (userPoolResult.UserPools || []).map(async (userPool) => {
        let clients = { UserPoolClients: [] }

        try {
          clients = await cognito.send(
            new ListUserPoolClientsCommand({
              UserPoolId: userPool.Id,
              MaxResults: 60,
            }),
          )
        } catch {
          failedServices.push(`Cognito clients for ${userPool.Name || userPool.Id}`)
        }

        return [
          {
            service: 'Cognito User Pool',
            name: userPool.Name,
            id: userPool.Id,
          },
          ...(clients.UserPoolClients || []).map((client) => ({
            service: 'Cognito Client',
            name: client.ClientName,
            id: client.ClientId,
          })),
        ]
      }),
    )

    const rules = (ruleResult.Rules || []).map((rule) => ({
      service: 'EventBridge Rule',
      name: rule.Name,
      id: rule.Arn,
    }))

    const stateMachines = (stateMachineResult.stateMachines || []).map((stateMachine) => ({
      service: 'Step Functions',
      name: stateMachine.name,
      id: stateMachine.stateMachineArn,
    }))

    resources.value = [
      ...buckets,
      ...tables,
      ...queues,
      ...topics,
      ...userPools.flat(),
      ...rules,
      ...stateMachines,
    ]

    if (failedServices.length > 0) {
      error.value = `Some resource types failed to load: ${failedServices.join(', ')}.`
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Failed to load resources.'
  } finally {
    loading.value = false
  }
}

onMounted(loadResources)
</script>

<style scoped>
.resource-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 16px;
}

.resource-id {
  color: rgb(var(--v-theme-on-surface-variant));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
  max-width: 520px;
  overflow-wrap: anywhere;
}
</style>
