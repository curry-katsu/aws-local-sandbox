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
  describeTable,
  fromDynamoItem,
  listTables,
  putTableItem,
  queryTable,
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

    it('applies filter expression when filter has attributeName and value', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      await scanTable('my-table', 10, { attributeName: 'status', value: 'active', attributeType: 'S', operator: '=' })
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('skips filter when value is empty string', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      await scanTable('my-table', 10, { attributeName: 'status', value: '', attributeType: 'S' })
      expect(mockSend).toHaveBeenCalledOnce()
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

    it('handles null input gracefully', () => {
      expect(fromDynamoItem(null)).toEqual({})
    })

    it('round-trips JavaScript values through DynamoDB format without data loss', () => {
      const original = { id: 'abc', count: 42, active: true, tags: ['x', 'y'] }
      expect(fromDynamoItem(toDynamoItem(original))).toEqual(original)
    })
  })
})
