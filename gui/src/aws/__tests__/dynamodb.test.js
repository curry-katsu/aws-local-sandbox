import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  CreateTableCommand: vi.fn(),
  DeleteItemCommand: vi.fn(),
  DescribeTableCommand: vi.fn(),
  ListTablesCommand: vi.fn(),
  PutItemCommand: vi.fn(),
  QueryCommand: vi.fn(),
  ScanCommand: vi.fn(),
}))

vi.mock('../config', () => ({
  clientConfig: {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  },
}))

import {
  buildDynamoKey,
  createTable,
  deleteTableItem,
  describeTable,
  fromDynamoItem,
  listTables,
  putTableItem,
  queryTable,
  scanAllTableItems,
  scanTable,
  toDynamoItem,
} from '../dynamodb'

describe('DynamoDB service', () => {
  describe('listTables', () => {
    beforeEach(() => mockSend.mockReset())

    it('returns table names from the API', async () => {
      mockSend.mockResolvedValueOnce({ TableNames: ['table-a', 'table-b'] })
      expect(await listTables()).toEqual(['table-a', 'table-b'])
    })

    it('returns empty array when TableNames is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await listTables()).toEqual([])
    })
  })

  describe('describeTable', () => {
    beforeEach(() => mockSend.mockReset())

    it('returns the Table property from the API response', async () => {
      const table = { TableName: 'my-table', ItemCount: 10 }
      mockSend.mockResolvedValueOnce({ Table: table })
      expect(await describeTable('my-table')).toEqual(table)
    })

    it('returns null when Table is missing', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await describeTable('my-table')).toBeNull()
    })
  })

  describe('createTable', () => {
    beforeEach(() => mockSend.mockReset())

    it('creates a table with partition key only', async () => {
      mockSend.mockResolvedValueOnce({})
      await createTable({
        tableName: 'new-table',
        partitionKeyName: 'id',
        partitionKeyType: 'S',
        readCapacityUnits: 5,
        writeCapacityUnits: 5,
      })
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('creates a table with partition key and sort key', async () => {
      mockSend.mockResolvedValueOnce({})
      await createTable({
        tableName: 'new-table',
        partitionKeyName: 'pk',
        partitionKeyType: 'S',
        sortKeyName: 'sk',
        sortKeyType: 'N',
        readCapacityUnits: 10,
        writeCapacityUnits: 10,
      })
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('defaults capacity units to 5 when not provided', async () => {
      mockSend.mockResolvedValueOnce({})
      await createTable({ tableName: 'new-table', partitionKeyName: 'id', partitionKeyType: 'S' })
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })

  describe('scanTable', () => {
    beforeEach(() => mockSend.mockReset())

    it('returns scanned items', async () => {
      const items = [{ id: { S: 'abc' }, value: { N: '1' } }]
      mockSend.mockResolvedValueOnce({ Items: items })
      expect(await scanTable('my-table', 10)).toEqual(items)
    })

    it('returns empty array when Items is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await scanTable('my-table', 10)).toEqual([])
    })

    it('applies equality filter expression', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      await scanTable('my-table', 10, { attributeName: 'status', value: 'active', attributeType: 'S', operator: '=' })
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('applies contains filter expression', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      await scanTable('my-table', 10, {
        attributeName: 'name',
        value: 'test',
        attributeType: 'S',
        operator: 'contains',
      })
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('skips filter when value is empty string', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      await scanTable('my-table', 10, { attributeName: 'status', value: '', attributeType: 'S' })
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('throws when filter value cannot be parsed as a number for N type', async () => {
      await expect(
        scanTable('my-table', 10, {
          attributeName: 'count',
          value: 'not-a-number',
          attributeType: 'N',
          operator: '=',
        }),
      ).rejects.toThrow('must be a number')
    })
  })

  describe('queryTable', () => {
    beforeEach(() => mockSend.mockReset())

    it('throws when the schema has no partition key', async () => {
      await expect(queryTable('table', [], [], {}, 10)).rejects.toThrow('partition key')
    })

    it('throws when partition key value is empty string', async () => {
      const schema = [{ AttributeName: 'pk', KeyType: 'HASH' }]
      await expect(
        queryTable('table', schema, [], { partitionKeyValue: '' }, 10),
      ).rejects.toThrow('pk')
    })

    it('executes query with only a partition key', async () => {
      mockSend.mockResolvedValueOnce({ Items: [{ pk: { S: 'abc' } }] })
      const schema = [{ AttributeName: 'pk', KeyType: 'HASH' }]
      const attrDefs = [{ AttributeName: 'pk', AttributeType: 'S' }]
      const result = await queryTable('table', schema, attrDefs, { partitionKeyValue: 'abc' }, 10)
      expect(result).toEqual([{ pk: { S: 'abc' } }])
    })

    it('executes query with partition key and sort key', async () => {
      mockSend.mockResolvedValueOnce({ Items: [{ pk: { S: 'abc' }, sk: { N: '1' } }] })
      const schema = [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ]
      const attrDefs = [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'N' },
      ]
      const result = await queryTable(
        'table',
        schema,
        attrDefs,
        { partitionKeyValue: 'abc', sortKeyValue: '1' },
        10,
      )
      expect(result).toEqual([{ pk: { S: 'abc' }, sk: { N: '1' } }])
    })
  })

  describe('scanAllTableItems', () => {
    beforeEach(() => mockSend.mockReset())

    it('returns all items from a single page', async () => {
      const items = [{ id: { S: 'a' } }, { id: { S: 'b' } }]
      mockSend.mockResolvedValueOnce({ Items: items, LastEvaluatedKey: undefined })
      expect(await scanAllTableItems('my-table')).toEqual(items)
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('paginates until LastEvaluatedKey is undefined', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [{ id: { S: 'a' } }], LastEvaluatedKey: { id: { S: 'a' } } })
        .mockResolvedValueOnce({ Items: [{ id: { S: 'b' } }], LastEvaluatedKey: undefined })
      const result = await scanAllTableItems('my-table')
      expect(result).toHaveLength(2)
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('returns empty array when the table has no items', async () => {
      mockSend.mockResolvedValueOnce({ Items: undefined, LastEvaluatedKey: undefined })
      expect(await scanAllTableItems('my-table')).toEqual([])
    })
  })

  describe('deleteTableItem', () => {
    beforeEach(() => mockSend.mockReset())

    it('calls send once with the correct key extracted from the item', async () => {
      mockSend.mockResolvedValueOnce({})
      const item = { id: { S: 'abc' }, name: { S: 'foo' } }
      const schema = [{ AttributeName: 'id', KeyType: 'HASH' }]
      await deleteTableItem('my-table', item, schema)
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('throws when the item is missing a key attribute', async () => {
      const item = { name: { S: 'foo' } }
      const schema = [{ AttributeName: 'id', KeyType: 'HASH' }]
      await expect(deleteTableItem('my-table', item, schema)).rejects.toThrow('id')
    })
  })

  describe('putTableItem', () => {
    beforeEach(() => mockSend.mockReset())

    it('calls send once with a PutItemCommand', async () => {
      mockSend.mockResolvedValueOnce({})
      await putTableItem('my-table', { id: 'abc', value: 42 })
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })

  describe('buildDynamoKey', () => {
    it('extracts only the partition key from an item', () => {
      const item = { id: { S: 'abc' }, name: { S: 'foo' } }
      const schema = [{ AttributeName: 'id', KeyType: 'HASH' }]
      expect(buildDynamoKey(item, schema)).toEqual({ id: { S: 'abc' } })
    })

    it('extracts both partition key and sort key', () => {
      const item = { pk: { S: 'a' }, sk: { N: '1' }, extra: { S: 'x' } }
      const schema = [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ]
      expect(buildDynamoKey(item, schema)).toEqual({ pk: { S: 'a' }, sk: { N: '1' } })
    })

    it('throws an error when a required key attribute is missing', () => {
      const item = { name: { S: 'foo' } }
      const schema = [{ AttributeName: 'id', KeyType: 'HASH' }]
      expect(() => buildDynamoKey(item, schema)).toThrow('id')
    })
  })

  describe('toDynamoItem', () => {
    it('converts string values to DynamoDB S type', () => {
      expect(toDynamoItem({ name: 'Alice' })).toEqual({ name: { S: 'Alice' } })
    })

    it('converts number values to DynamoDB N type (stored as string)', () => {
      expect(toDynamoItem({ age: 30 })).toEqual({ age: { N: '30' } })
    })

    it('converts boolean values to DynamoDB BOOL type', () => {
      expect(toDynamoItem({ active: true })).toEqual({ active: { BOOL: true } })
      expect(toDynamoItem({ active: false })).toEqual({ active: { BOOL: false } })
    })

    it('converts null to DynamoDB NULL type', () => {
      expect(toDynamoItem({ nothing: null })).toEqual({ nothing: { NULL: true } })
    })

    it('converts arrays to DynamoDB L type', () => {
      expect(toDynamoItem({ tags: ['a', 'b'] })).toEqual({
        tags: { L: [{ S: 'a' }, { S: 'b' }] },
      })
    })

    it('converts nested objects to DynamoDB M type', () => {
      expect(toDynamoItem({ meta: { count: 1 } })).toEqual({
        meta: { M: { count: { N: '1' } } },
      })
    })

    it('skips undefined values', () => {
      expect(toDynamoItem({ a: 'present', b: undefined })).toEqual({ a: { S: 'present' } })
    })

    it('throws for unsupported value types', () => {
      expect(() => toDynamoItem({ sym: Symbol('x') })).toThrow()
    })
  })

  describe('fromDynamoItem', () => {
    it('converts S type to string', () => {
      expect(fromDynamoItem({ name: { S: 'Alice' } })).toEqual({ name: 'Alice' })
    })

    it('converts N type to number', () => {
      expect(fromDynamoItem({ age: { N: '30' } })).toEqual({ age: 30 })
    })

    it('converts BOOL type to boolean', () => {
      expect(fromDynamoItem({ active: { BOOL: false } })).toEqual({ active: false })
    })

    it('converts NULL type to null', () => {
      expect(fromDynamoItem({ val: { NULL: true } })).toEqual({ val: null })
    })

    it('converts L type to array', () => {
      expect(fromDynamoItem({ tags: { L: [{ S: 'a' }, { S: 'b' }] } })).toEqual({
        tags: ['a', 'b'],
      })
    })

    it('converts M type to nested object', () => {
      expect(fromDynamoItem({ meta: { M: { count: { N: '5' } } } })).toEqual({
        meta: { count: 5 },
      })
    })

    it('converts SS type to string array', () => {
      expect(fromDynamoItem({ tags: { SS: ['a', 'b', 'c'] } })).toEqual({ tags: ['a', 'b', 'c'] })
    })

    it('converts NS type to number array', () => {
      expect(fromDynamoItem({ counts: { NS: ['1', '2', '3'] } })).toEqual({ counts: [1, 2, 3] })
    })

    it('converts BS type to binary array as-is', () => {
      const data = [new Uint8Array([1, 2, 3])]
      expect(fromDynamoItem({ bin: { BS: data } })).toEqual({ bin: data })
    })

    it('returns unrecognized DynamoDB type value as-is', () => {
      const unknown = { CUSTOM: 'value' }
      expect(fromDynamoItem({ field: unknown })).toEqual({ field: unknown })
    })

    it('handles null input gracefully', () => {
      expect(fromDynamoItem(null)).toEqual({})
    })

    it('round-trips JavaScript values through DynamoDB format without data loss', () => {
      const original = { id: 'abc', count: 42, active: true, tags: ['x', 'y'] }
      expect(fromDynamoItem(toDynamoItem(original))).toEqual(original)
    })
  })
})
