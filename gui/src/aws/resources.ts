import { ListUserPoolClientsCommand, ListUserPoolsCommand } from '@aws-sdk/client-cognito-identity-provider'
import { ListRulesCommand } from '@aws-sdk/client-eventbridge'
import { ListStateMachinesCommand } from '@aws-sdk/client-sfn'
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { EventBridgeClient } from '@aws-sdk/client-eventbridge'
import { LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda'
import { RDSClient, DescribeDBClustersCommand } from '@aws-sdk/client-rds'
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3'
import { SecretsManagerClient, ListSecretsCommand } from '@aws-sdk/client-secrets-manager'
import { SFNClient } from '@aws-sdk/client-sfn'
import { SNSClient, ListTopicsCommand } from '@aws-sdk/client-sns'
import { SQSClient, ListQueuesCommand } from '@aws-sdk/client-sqs'
import { SSMClient, DescribeParametersCommand } from '@aws-sdk/client-ssm'
import { clientConfig, s3ClientConfig } from './config'

const s3 = new S3Client(s3ClientConfig)
const dynamodb = new DynamoDBClient(clientConfig)
const sqs = new SQSClient(clientConfig)
const sns = new SNSClient(clientConfig)
const cognito = new CognitoIdentityProviderClient(clientConfig)
const eventbridge = new EventBridgeClient(clientConfig)
const lambda = new LambdaClient(clientConfig)
const sfn = new SFNClient(clientConfig)
const rds = new RDSClient(clientConfig)
const secretsManager = new SecretsManagerClient(clientConfig)
const ssm = new SSMClient(clientConfig)

export async function discoverResources() {
  const [
    bucketOutcome,
    tableOutcome,
    queueOutcome,
    topicOutcome,
    userPoolOutcome,
    ruleOutcome,
    lambdaOutcome,
    stateMachineOutcome,
    dbClusterOutcome,
    secretOutcome,
    parameterOutcome,
  ] = await Promise.allSettled([
    s3.send(new ListBucketsCommand({})),
    dynamodb.send(new ListTablesCommand({})),
    sqs.send(new ListQueuesCommand({})),
    sns.send(new ListTopicsCommand({})),
    cognito.send(new ListUserPoolsCommand({ MaxResults: 60 })),
    eventbridge.send(new ListRulesCommand({ Limit: 100 })),
    lambda.send(new ListFunctionsCommand({ MaxItems: 50 })),
    sfn.send(new ListStateMachinesCommand({ maxResults: 100 })),
    rds.send(new DescribeDBClustersCommand({})),
    secretsManager.send(new ListSecretsCommand({ MaxResults: 100 })),
    ssm.send(new DescribeParametersCommand({ MaxResults: 50 })),
  ])

  const failedServices = []
  const resultOrDefault = (service, outcome, fallback) => {
    if (outcome.status === 'fulfilled') return outcome.value
    failedServices.push(service)
    return fallback
  }

  const bucketResult = resultOrDefault('S3', bucketOutcome, { Buckets: [] })
  const tableResult = resultOrDefault('DynamoDB', tableOutcome, { TableNames: [] })
  const queueResult = resultOrDefault('SQS', queueOutcome, { QueueUrls: [] })
  const topicResult = resultOrDefault('SNS', topicOutcome, { Topics: [] })
  const userPoolResult = resultOrDefault('Cognito', userPoolOutcome, { UserPools: [] })
  const ruleResult = resultOrDefault('EventBridge', ruleOutcome, { Rules: [] })
  const lambdaResult = resultOrDefault('Lambda', lambdaOutcome, { Functions: [] })
  const stateMachineResult = resultOrDefault('Step Functions', stateMachineOutcome, {
    stateMachines: [],
  })
  const dbClusterResult = resultOrDefault('RDS', dbClusterOutcome, { DBClusters: [] })
  const secretResult = resultOrDefault('Secrets Manager', secretOutcome, { SecretList: [] })
  const parameterResult = resultOrDefault('Parameter Store', parameterOutcome, { Parameters: [] })

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

  return {
    resources: [
      ...(bucketResult.Buckets || []).map((bucket) => ({
        service: 'S3',
        name: bucket.Name,
        id: bucket.Name,
      })),
      ...(tableResult.TableNames || []).map((tableName) => ({
        service: 'DynamoDB',
        name: tableName,
        id: tableName,
      })),
      ...(queueResult.QueueUrls || []).map((queueUrl) => ({
        service: 'SQS',
        name: queueUrl.split('/').pop(),
        id: queueUrl,
      })),
      ...(topicResult.Topics || []).map((topic) => ({
        service: 'SNS',
        name: topic.TopicArn.split(':').pop(),
        id: topic.TopicArn,
      })),
      ...userPools.flat(),
      ...(ruleResult.Rules || []).map((rule) => ({
        service: 'EventBridge Rule',
        name: rule.Name,
        id: rule.Arn,
      })),
      ...(lambdaResult.Functions || []).map((fn) => ({
        service: 'Lambda',
        name: fn.FunctionName,
        id: fn.FunctionArn,
      })),
      ...(stateMachineResult.stateMachines || []).map((stateMachine) => ({
        service: 'Step Functions',
        name: stateMachine.name,
        id: stateMachine.stateMachineArn,
      })),
      ...(dbClusterResult.DBClusters || []).map((cluster) => ({
        service: 'RDS Cluster',
        name: cluster.DBClusterIdentifier,
        id: `${cluster.Engine || 'unknown'}:${cluster.EngineVersion || 'unknown'}`,
      })),
      ...(secretResult.SecretList || []).map((secret) => ({
        service: 'Secrets Manager',
        name: secret.Name,
        id: secret.ARN,
      })),
      ...(parameterResult.Parameters || []).map((parameter) => ({
        service: 'Parameter Store',
        name: parameter.Name,
        id: `${parameter.Type || 'unknown'}:${parameter.Version || 0}`,
      })),
    ],
    failedServices,
  }
}
