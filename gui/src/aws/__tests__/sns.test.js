import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: vi.fn(() => ({ send: mockSend })),
  CreateTopicCommand: vi.fn(),
  DeleteTopicCommand: vi.fn(),
  GetTopicAttributesCommand: vi.fn(),
  ListSubscriptionsByTopicCommand: vi.fn(),
  ListTopicsCommand: vi.fn(),
  PublishCommand: vi.fn(),
  SetTopicAttributesCommand: vi.fn(),
}))

vi.mock('../config', () => ({
  clientConfig: {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  },
}))

import { createTopic, deleteTopic, getTopicDetail, listTopics, publishTopicMessage, setTopicDisplayName } from '../sns'

describe('sns service', () => {
  beforeEach(() => mockSend.mockReset())

  describe('listTopics', () => {
    it('returns topics from the API', async () => {
      const topics = [{ TopicArn: 'arn:aws:sns:us-east-1:000000000000:my-topic' }]
      mockSend.mockResolvedValueOnce({ Topics: topics })
      expect(await listTopics()).toEqual(topics)
    })

    it('returns empty array when Topics is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await listTopics()).toEqual([])
    })
  })

  describe('getTopicDetail', () => {
    it('returns combined attributes and subscriptions', async () => {
      mockSend
        .mockResolvedValueOnce({ Attributes: { DisplayName: 'My Topic', SubscriptionsConfirmed: '1' } })
        .mockResolvedValueOnce({ Subscriptions: [{ SubscriptionArn: 'arn:...' }] })
      const result = await getTopicDetail('arn:...')
      expect(result.attributes).toEqual({ DisplayName: 'My Topic', SubscriptionsConfirmed: '1' })
      expect(result.subscriptions).toHaveLength(1)
    })

    it('returns empty defaults when both API calls return no data', async () => {
      mockSend.mockResolvedValue({})
      const result = await getTopicDetail('arn:...')
      expect(result.attributes).toEqual({})
      expect(result.subscriptions).toEqual([])
    })
  })

  describe('createTopic', () => {
    it('returns the new topic ARN', async () => {
      mockSend.mockResolvedValueOnce({ TopicArn: 'arn:aws:sns:us-east-1:000000000000:new-topic' })
      expect(await createTopic('new-topic')).toBe(
        'arn:aws:sns:us-east-1:000000000000:new-topic',
      )
    })

    it('returns empty string when TopicArn is missing', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await createTopic('new-topic')).toBe('')
    })
  })

  describe('deleteTopic', () => {
    it('calls send once for the given topic ARN', async () => {
      mockSend.mockResolvedValueOnce({})
      await deleteTopic('arn:...')
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })

  describe('publishTopicMessage', () => {
    it('sends a message with subject and body', async () => {
      mockSend.mockResolvedValueOnce({})
      await publishTopicMessage('arn:...', 'My Subject', 'Hello world')
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('uses "{}" as body when message is empty string', async () => {
      mockSend.mockResolvedValueOnce({})
      await publishTopicMessage('arn:...', '', '')
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })

  describe('setTopicDisplayName', () => {
    it('calls send once for updating the display name', async () => {
      mockSend.mockResolvedValueOnce({})
      await setTopicDisplayName('arn:...', 'New Display Name')
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })
})
