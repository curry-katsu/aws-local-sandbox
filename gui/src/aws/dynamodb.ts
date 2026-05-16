import {
  CreateTableCommand,
  DeleteItemCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  PutItemCommand,
  QueryCommand,
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

export async function createTable(table) {
  const keySchema = [{ AttributeName: table.partitionKeyName, KeyType: 'HASH' }]
  const attributeDefinitions = [
    { AttributeName: table.partitionKeyName, AttributeType: table.partitionKeyType },
  ]

  if (table.sortKeyName) {
    keySchema.push({ AttributeName: table.sortKeyName, KeyType: 'RANGE' })
    attributeDefinitions.push({
      AttributeName: table.sortKeyName,
      AttributeType: table.sortKeyType,
    })
  }

  await dynamodb.send(
    new CreateTableCommand({
      TableName: table.tableName,
      KeySchema: keySchema,
      AttributeDefinitions: attributeDefinitions,
      ProvisionedThroughput: {
        ReadCapacityUnits: Number(table.readCapacityUnits) || 5,
        WriteCapacityUnits: Number(table.writeCapacityUnits) || 5,
      },
    }),
  )
}

export async function scanTable(tableName, limit, filter = null) {
  const input = {
    TableName: tableName,
    Limit: limit,
  }

  if (filter?.attributeName && filter?.value !== '') {
    input.ExpressionAttributeNames = { '#filterAttr': filter.attributeName }
    input.ExpressionAttributeValues = {
      ':filterValue': toDynamoValueFromTypedString(filter.value, filter.attributeType),
    }
    input.FilterExpression =
      filter.operator === 'contains'
        ? 'contains(#filterAttr, :filterValue)'
        : '#filterAttr = :filterValue'
  }

  const result = await dynamodb.send(new ScanCommand(input))
  return result.Items || []
}

export async function scanAllTableItems(tableName) {
  const items = []
  let exclusiveStartKey = undefined

  do {
    const result = await dynamodb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    )
    items.push(...(result.Items || []))
    exclusiveStartKey = result.LastEvaluatedKey
  } while (exclusiveStartKey)

  return items
}

export async function queryTable(tableName, keySchema, attributeDefinitions, keyValues, limit) {
  const partitionKey = keySchema.find((key) => key.KeyType === 'HASH')
  const sortKey = keySchema.find((key) => key.KeyType === 'RANGE')
  if (!partitionKey) {
    throw new Error('Selected table does not have a partition key.')
  }
  if (!keyValues.partitionKeyValue) {
    throw new Error(`${partitionKey.AttributeName} is required for Query.`)
  }

  const names = { '#pk': partitionKey.AttributeName }
  const values = {
    ':pk': toDynamoValueFromTypedString(
      keyValues.partitionKeyValue,
      attributeTypeFor(partitionKey.AttributeName, attributeDefinitions),
    ),
  }
  const expressions = ['#pk = :pk']

  if (sortKey && keyValues.sortKeyValue) {
    names['#sk'] = sortKey.AttributeName
    values[':sk'] = toDynamoValueFromTypedString(
      keyValues.sortKeyValue,
      attributeTypeFor(sortKey.AttributeName, attributeDefinitions),
    )
    expressions.push('#sk = :sk')
  }

  const result = await dynamodb.send(
    new QueryCommand({
      TableName: tableName,
      Limit: limit,
      KeyConditionExpression: expressions.join(' AND '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
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

function toDynamoValueFromTypedString(value, attributeType) {
  if (attributeType === 'N') {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      throw new Error(`Value "${value}" must be a number.`)
    }
    return { N: String(parsed) }
  }
  if (attributeType === 'B') return { B: value }
  return { S: String(value) }
}

function attributeTypeFor(attributeName, attributeDefinitions) {
  return (
    attributeDefinitions.find((attribute) => attribute.AttributeName === attributeName)
      ?.AttributeType || 'S'
  )
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
