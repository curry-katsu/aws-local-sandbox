import {
  DeleteItemCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  PutItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb'
import { clientConfig } from './config'

const dynamodb = new DynamoDBClient(clientConfig)

export async function listTables() {
  const result = await dynamodb.send(new ListTablesCommand({}))
  return result.TableNames || []
}

export async function describeTable(tableName) {
  const result = await dynamodb.send(new DescribeTableCommand({ TableName: tableName }))
  return result.Table || null
}

export async function scanTable(tableName, limit) {
  const result = await dynamodb.send(
    new ScanCommand({
      TableName: tableName,
      Limit: limit,
    }),
  )
  return result.Items || []
}

export async function putTableItem(tableName, item) {
  await dynamodb.send(
    new PutItemCommand({
      TableName: tableName,
      Item: toDynamoItem(item),
    }),
  )
}

export async function deleteTableItem(tableName, rawItem, keySchema) {
  await dynamodb.send(
    new DeleteItemCommand({
      TableName: tableName,
      Key: buildDynamoKey(rawItem, keySchema),
    }),
  )
}

export function buildDynamoKey(rawItem, keySchema) {
  const key = {}
  for (const keyPart of keySchema) {
    const attribute = rawItem[keyPart.AttributeName]
    if (!attribute) {
      throw new Error(`Selected item is missing key attribute ${keyPart.AttributeName}.`)
    }
    key[keyPart.AttributeName] = attribute
  }
  return key
}

export function toDynamoItem(item) {
  return Object.fromEntries(
    Object.entries(item)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, toDynamoValue(value)]),
  )
}

function toDynamoValue(value) {
  if (value === null) return { NULL: true }
  if (typeof value === 'string') return { S: value }
  if (typeof value === 'number') return { N: String(value) }
  if (typeof value === 'boolean') return { BOOL: value }
  if (Array.isArray(value)) return { L: value.map(toDynamoValue) }
  if (typeof value === 'object') return { M: toDynamoItem(value) }
  throw new Error(`Unsupported DynamoDB JSON value: ${String(value)}`)
}

export function fromDynamoItem(item) {
  return Object.fromEntries(
    Object.entries(item || {}).map(([key, value]) => [key, fromDynamoValue(value)]),
  )
}

function fromDynamoValue(value) {
  if ('S' in value) return value.S
  if ('N' in value) return Number(value.N)
  if ('BOOL' in value) return value.BOOL
  if ('NULL' in value) return null
  if ('L' in value) return (value.L || []).map(fromDynamoValue)
  if ('M' in value) return fromDynamoItem(value.M)
  if ('SS' in value) return value.SS || []
  if ('NS' in value) return (value.NS || []).map(Number)
  if ('BS' in value) return value.BS || []
  return value
}

