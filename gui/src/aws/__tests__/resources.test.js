import { beforeEach, describe, expect, it, vi } from 'vitest'

// All clients share a single mockSend — each service call picks its relevant fields
const mockSend = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: mockSend })),
  ListBucketsCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  ListTablesCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: vi.fn(() => ({ send: mockSend })),
  ListQueuesCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: vi.fn(() => ({ send: mockSend })),
  ListTopicsCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: vi.fn(() => ({ send: mockSend })),
  ListUserPoolClientsCommand: vi.fn(),
  ListUserPoolsCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn(() => ({ send: mockSend })),
  ListRulesCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn(() => ({ send: mockSend })),
  ListFunctionsCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: vi.fn(() => ({ send: mockSend })),
  ListStateMachinesCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-rds', () => ({
  RDSClient: vi.fn(() => ({ send: mockSend })),
  DescribeDBClustersCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn(() => ({ send: mockSend })),
  ListSecretsCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: vi.fn(() => ({ send: mockSend })),
  DescribeParametersCommand: vi.fn(),
}))

vi.mock('../config', () => ({
  clientConfig: {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  },
  s3ClientConfig: {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    forcePathStyle: true,
  },
}))

import { discoverResources } from '../resources'

// A combined response that works for all 11 service calls — each call only reads its own fields
const EMPTY_RESPONSE = {}
const FULL_RESPONSE = {
  Buckets: [{ Name: 'my-bucket' }],
  TableNames: ['my-table'],
  QueueUrls: ['http://localhost:4566/000000000000/my-queue'],
  Topics: [{ TopicArn: 'arn:aws:sns:us-east-1:000000000000:my-topic' }],
  UserPools: [],
  Rules: [{ Name: 'my-rule', Arn: 'arn:aws:events:us-east-1:000000000000:rule/my-rule' }],
  Functions: [
    {
      FunctionName: 'my-function',
      FunctionArn: 'arn:aws:lambda:us-east-1:000000000000:function:my-function',
    },
  ],
  stateMachines: [
    {
      name: 'my-state-machine',
      stateMachineArn: 'arn:aws:states:us-east-1:000000000000:stateMachine:my-state-machine',
    },
  ],
  DBClusters: [{ DBClusterIdentifier: 'my-cluster', Engine: 'aurora', EngineVersion: '5.7' }],
  SecretList: [{ Name: 'my-secret', ARN: 'arn:aws:secretsmanager:us-east-1:000000000000:secret:my-secret' }],
  Parameters: [{ Name: '/my/param', Type: 'String', Version: 1 }],
}

describe('discoverResources', () => {
  beforeEach(() => mockSend.mockReset())

  it('returns empty resources and no failed services when all services return empty', async () => {
    mockSend.mockResolvedValue(EMPTY_RESPONSE)
    const { resources, failedServices } = await discoverResources()
    expect(resources).toEqual([])
    expect(failedServices).toEqual([])
  })

  it('maps S3 buckets to resources with service="S3"', async () => {
    mockSend.mockResolvedValue(FULL_RESPONSE)
    const { resources } = await discoverResources()
    const s3 = resources.filter((r) => r.service === 'S3')
    expect(s3).toHaveLength(1)
    expect(s3[0]).toEqual({ service: 'S3', name: 'my-bucket', id: 'my-bucket' })
  })

  it('maps DynamoDB tables to resources with service="DynamoDB"', async () => {
    mockSend.mockResolvedValue(FULL_RESPONSE)
    const { resources } = await discoverResources()
    const dynamo = resources.filter((r) => r.service === 'DynamoDB')
    expect(dynamo).toHaveLength(1)
    expect(dynamo[0]).toEqual({ service: 'DynamoDB', name: 'my-table', id: 'my-table' })
  })

  it('maps SQS queues to resources using the last URL segment as the name', async () => {
    mockSend.mockResolvedValue(FULL_RESPONSE)
    const { resources } = await discoverResources()
    const sqs = resources.filter((r) => r.service === 'SQS')
    expect(sqs).toHaveLength(1)
    expect(sqs[0].name).toBe('my-queue')
    expect(sqs[0].id).toContain('my-queue')
  })

  it('maps SNS topics to resources using the last ARN segment as the name', async () => {
    mockSend.mockResolvedValue(FULL_RESPONSE)
    const { resources } = await discoverResources()
    const sns = resources.filter((r) => r.service === 'SNS')
    expect(sns).toHaveLength(1)
    expect(sns[0].name).toBe('my-topic')
  })

  it('maps EventBridge rules to resources with service="EventBridge Rule"', async () => {
    mockSend.mockResolvedValue(FULL_RESPONSE)
    const { resources } = await discoverResources()
    const eb = resources.filter((r) => r.service === 'EventBridge Rule')
    expect(eb).toHaveLength(1)
    expect(eb[0].name).toBe('my-rule')
  })

  it('maps Lambda functions to resources with service="Lambda"', async () => {
    mockSend.mockResolvedValue(FULL_RESPONSE)
    const { resources } = await discoverResources()
    const lambda = resources.filter((r) => r.service === 'Lambda')
    expect(lambda).toHaveLength(1)
    expect(lambda[0].name).toBe('my-function')
  })

  it('maps Step Functions to resources with service="Step Functions"', async () => {
    mockSend.mockResolvedValue(FULL_RESPONSE)
    const { resources } = await discoverResources()
    const sfn = resources.filter((r) => r.service === 'Step Functions')
    expect(sfn).toHaveLength(1)
    expect(sfn[0].name).toBe('my-state-machine')
  })

  it('maps RDS clusters to resources with service="RDS Cluster"', async () => {
    mockSend.mockResolvedValue(FULL_RESPONSE)
    const { resources } = await discoverResources()
    const rds = resources.filter((r) => r.service === 'RDS Cluster')
    expect(rds).toHaveLength(1)
    expect(rds[0].name).toBe('my-cluster')
  })

  it('maps Secrets Manager secrets to resources with service="Secrets Manager"', async () => {
    mockSend.mockResolvedValue(FULL_RESPONSE)
    const { resources } = await discoverResources()
    const sm = resources.filter((r) => r.service === 'Secrets Manager')
    expect(sm).toHaveLength(1)
    expect(sm[0].name).toBe('my-secret')
  })

  it('maps Parameter Store parameters to resources with service="Parameter Store"', async () => {
    mockSend.mockResolvedValue(FULL_RESPONSE)
    const { resources } = await discoverResources()
    const ps = resources.filter((r) => r.service === 'Parameter Store')
    expect(ps).toHaveLength(1)
    expect(ps[0].name).toBe('/my/param')
  })

  it('adds failed service names when calls throw', async () => {
    // Promise.allSettled call order in resources.ts:
    // 1=S3, 2=DynamoDB, 3=SQS, 4=SNS, 5=Cognito, 6=EventBridge, 7=Lambda, 8=SFN, 9=RDS, 10=SecretsManager, 11=SSM
    for (let i = 0; i < 11; i++) {
      mockSend.mockRejectedValueOnce(new Error('Service unavailable'))
    }
    const { resources, failedServices } = await discoverResources()
    expect(resources).toEqual([])
    expect(failedServices).toContain('S3')
    expect(failedServices).toContain('DynamoDB')
    expect(failedServices).toContain('SQS')
    expect(failedServices).toContain('SNS')
    expect(failedServices).toContain('Lambda')
    expect(failedServices).toContain('RDS')
  })

  it('handles partial failures — successful services still appear in resources', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('S3 down'))    // S3 fails
      .mockResolvedValue(FULL_RESPONSE)               // all others succeed
    const { resources, failedServices } = await discoverResources()
    expect(failedServices).toContain('S3')
    // At least some other services should have resources
    expect(resources.length).toBeGreaterThan(0)
  })

  it('discovers Cognito user pool and its clients', async () => {
    const responseWithCognito = {
      ...EMPTY_RESPONSE,
      UserPools: [{ Id: 'pool-1', Name: 'my-pool' }],
      UserPoolClients: [{ ClientId: 'client-1', ClientName: 'my-client' }],
    }
    mockSend.mockResolvedValue(responseWithCognito)
    const { resources } = await discoverResources()
    const pools = resources.filter((r) => r.service === 'Cognito User Pool')
    const clients = resources.filter((r) => r.service === 'Cognito Client')
    expect(pools).toHaveLength(1)
    expect(pools[0]).toEqual({ service: 'Cognito User Pool', name: 'my-pool', id: 'pool-1' })
    expect(clients).toHaveLength(1)
    expect(clients[0]).toEqual({ service: 'Cognito Client', name: 'my-client', id: 'client-1' })
  })

  it('adds Cognito client fetch failure to failedServices without throwing', async () => {
    // Promise.allSettled call order: S3(1), DynamoDB(2), SQS(3), SNS(4), Cognito(5), EB(6), Lambda(7), SFN(8), RDS(9), SM(10), SSM(11)
    // Cognito ListUserPools is call #5 → set first 4 to EMPTY_RESPONSE, then the Cognito pool response
    mockSend
      .mockResolvedValueOnce(EMPTY_RESPONSE)  // S3
      .mockResolvedValueOnce(EMPTY_RESPONSE)  // DynamoDB
      .mockResolvedValueOnce(EMPTY_RESPONSE)  // SQS
      .mockResolvedValueOnce(EMPTY_RESPONSE)  // SNS
      .mockResolvedValueOnce({ UserPools: [{ Id: 'pool-1', Name: 'my-pool' }] })  // Cognito ListUserPools
      .mockResolvedValueOnce(EMPTY_RESPONSE)  // EventBridge
      .mockResolvedValueOnce(EMPTY_RESPONSE)  // Lambda
      .mockResolvedValueOnce(EMPTY_RESPONSE)  // SFN
      .mockResolvedValueOnce(EMPTY_RESPONSE)  // RDS
      .mockResolvedValueOnce(EMPTY_RESPONSE)  // SecretsManager
      .mockResolvedValueOnce(EMPTY_RESPONSE)  // SSM
      .mockRejectedValueOnce(new Error('Forbidden'))  // Cognito ListUserPoolClients (after allSettled)
    const { failedServices } = await discoverResources()
    expect(failedServices.some((s) => s.includes('my-pool') || s.includes('pool-1'))).toBe(true)
  })
})
