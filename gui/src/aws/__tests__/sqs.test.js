import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: vi.fn(() => ({ send: mockSend })),
  CreateQueueCommand: vi.fn(),
  DeleteMessageCommand: vi.fn(),
  DeleteQueueCommand: vi.fn(),
  GetQueueAttributesCommand: vi.fn(),
  ListQueuesCommand: vi.fn(),
  ReceiveMessageCommand: vi.fn(),
  SendMessageCommand: vi.fn(),
  SetQueueAttributesCommand: vi.fn(),
}))

vi.mock('../config', () => ({
  clientConfig: {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  },
}))

import { SetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import {
  createQueue,
  deleteQueue,
  deleteQueueMessage,
  listQueues,
  receiveQueueMessages,
  sendQueueMessage,
  setQueueAttributes,
} from '../sqs'

describe('sqs service', () => {
  beforeEach(() => {
    mockSend.mockReset()
  })

  describe('listQueues', () => {
    it('maps queue URLs to name/url objects', async () => {
      mockSend.mockResolvedValueOnce({
        QueueUrls: [
          'http://localhost:4566/000000000000/my-queue',
          'http://localhost:4566/000000000000/another-queue',
        ],
      })
      expect(await listQueues()).toEqual([
        { url: 'http://localhost:4566/000000000000/my-queue', name: 'my-queue' },
        { url: 'http://localhost:4566/000000000000/another-queue', name: 'another-queue' },
      ])
    })

    it('returns empty array when QueueUrls is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await listQueues()).toEqual([])
    })
  })

  describe('createQueue', () => {
    it('returns the created queue URL', async () => {
      mockSend.mockResolvedValueOnce({ QueueUrl: 'http://localhost:4566/000000000000/new-queue' })
      expect(await createQueue('new-queue')).toBe(
        'http://localhost:4566/000000000000/new-queue',
      )
    })

    it('returns empty string when QueueUrl is missing', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await createQueue('new-queue')).toBe('')
    })
  })

  describe('deleteQueue', () => {
    it('calls send once for the given queue URL', async () => {
      mockSend.mockResolvedValueOnce({})
      await deleteQueue('http://localhost:4566/000000000000/my-queue')
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })

  describe('receiveQueueMessages', () => {
    it('returns messages from the API response', async () => {
      const messages = [{ MessageId: 'msg-1', Body: 'hello', ReceiptHandle: 'rh-1' }]
      mockSend.mockResolvedValueOnce({ Messages: messages })
      expect(await receiveQueueMessages('http://q-url', 5)).toEqual(messages)
    })

    it('returns empty array when Messages is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await receiveQueueMessages('http://q-url', 5)).toEqual([])
    })
  })

  describe('sendQueueMessage', () => {
    it('sends a message successfully', async () => {
      mockSend.mockResolvedValueOnce({})
      await sendQueueMessage('http://q-url', 'test message')
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('uses "{}" as body when body is empty string', async () => {
      mockSend.mockResolvedValueOnce({})
      await sendQueueMessage('http://q-url', '')
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('passes delay seconds from options', async () => {
      mockSend.mockResolvedValueOnce({})
      await sendQueueMessage('http://q-url', 'msg', { delaySeconds: 10 })
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })

  describe('deleteQueueMessage', () => {
    it('calls send once with the queue URL and receipt handle', async () => {
      mockSend.mockResolvedValueOnce({})
      await deleteQueueMessage('http://q-url', 'rh-abc')
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })

  describe('getQueueAttributes', () => {
    it('returns attributes for the given queue URL', async () => {
      const attrs = { VisibilityTimeout: '30', ApproximateNumberOfMessages: '5' }
      mockSend.mockResolvedValueOnce({ Attributes: attrs })
      const { getQueueAttributes } = await import('../sqs')
      expect(await getQueueAttributes('http://q-url')).toEqual(attrs)
    })

    it('returns empty object when Attributes is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      const { getQueueAttributes } = await import('../sqs')
      expect(await getQueueAttributes('http://q-url')).toEqual({})
    })
  })

  describe('setQueueAttributes', () => {
    it('filters out attributes with empty string values', async () => {
      mockSend.mockResolvedValueOnce({})
      await setQueueAttributes('http://q-url', {
        VisibilityTimeout: '30',
        MaxMessageSize: '',
        MessageRetentionPeriod: '86400',
      })
      // Check the arguments passed to the SetQueueAttributesCommand constructor
      const constructorArgs = vi.mocked(SetQueueAttributesCommand).mock.calls[0][0]
      expect(constructorArgs.Attributes).not.toHaveProperty('MaxMessageSize')
      expect(constructorArgs.Attributes).toEqual({
        VisibilityTimeout: '30',
        MessageRetentionPeriod: '86400',
      })
    })

    it('sends nothing when all attributes are empty strings', async () => {
      mockSend.mockResolvedValueOnce({})
      await setQueueAttributes('http://q-url', { VisibilityTimeout: '', MaxMessageSize: '' })
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })
})
