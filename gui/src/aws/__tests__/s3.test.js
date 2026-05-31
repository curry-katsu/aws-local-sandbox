import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: mockSend })),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  ListBucketsCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
  PutObjectCommand: vi.fn(),
}))

vi.mock('../config', () => ({
  s3ClientConfig: {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    forcePathStyle: true,
  },
}))

import { deleteObject, getObjectText, listBuckets, listObjects, putTextObject } from '../s3'

describe('s3 service', () => {
  beforeEach(() => {
    mockSend.mockReset()
  })

  describe('listBuckets', () => {
    it('returns buckets from the API response', async () => {
      mockSend.mockResolvedValueOnce({ Buckets: [{ Name: 'bucket-a' }, { Name: 'bucket-b' }] })
      expect(await listBuckets()).toEqual([{ Name: 'bucket-a' }, { Name: 'bucket-b' }])
    })

    it('returns empty array when Buckets is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await listBuckets()).toEqual([])
    })

    it('propagates errors from the SDK', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'))
      await expect(listBuckets()).rejects.toThrow('Network error')
    })
  })

  describe('listObjects', () => {
    it('returns objects for the given bucket and prefix', async () => {
      mockSend.mockResolvedValueOnce({ Contents: [{ Key: 'file.txt', Size: 512 }] })
      expect(await listObjects('my-bucket', 'prefix/')).toEqual([{ Key: 'file.txt', Size: 512 }])
    })

    it('returns empty array when Contents is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await listObjects('my-bucket', null)).toEqual([])
    })

    it('passes undefined prefix when prefix is empty string', async () => {
      mockSend.mockResolvedValueOnce({ Contents: [] })
      await listObjects('my-bucket', '')
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })

  describe('getObjectText', () => {
    it('returns text from Body.transformToString', async () => {
      mockSend.mockResolvedValueOnce({
        Body: { transformToString: () => Promise.resolve('hello world') },
      })
      expect(await getObjectText('bucket', 'key.txt')).toBe('hello world')
    })

    it('returns empty string when Body is missing', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await getObjectText('bucket', 'key.txt')).toBe('')
    })
  })

  describe('putTextObject', () => {
    it('calls send once with the correct key and body', async () => {
      mockSend.mockResolvedValueOnce({})
      await putTextObject('bucket', 'key.txt', 'hello', 'text/plain')
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('does not throw when contentType is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      await expect(putTextObject('bucket', 'key.txt', 'hello', undefined)).resolves.toBeUndefined()
    })
  })

  describe('deleteObject', () => {
    it('calls send once with the given bucket and key', async () => {
      mockSend.mockResolvedValueOnce({})
      await deleteObject('bucket', 'key.txt')
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })
})
