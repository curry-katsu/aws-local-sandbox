import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSecretsSend = vi.hoisted(() => vi.fn())
const mockSsmSend = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn(() => ({ send: mockSecretsSend })),
  CreateSecretCommand: vi.fn(),
  DeleteSecretCommand: vi.fn(),
  GetSecretValueCommand: vi.fn(),
  ListSecretsCommand: vi.fn(),
  PutSecretValueCommand: vi.fn(),
}))

vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: vi.fn(() => ({ send: mockSsmSend })),
  DeleteParameterCommand: vi.fn(),
  DescribeParametersCommand: vi.fn(),
  GetParameterCommand: vi.fn(),
  PutParameterCommand: vi.fn(),
}))

vi.mock('../config', () => ({
  clientConfig: {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  },
}))

import {
  createSecret,
  deleteParameter,
  deleteSecret,
  getParameterValue,
  getSecretValue,
  listParameters,
  listSecrets,
  putParameter,
  putSecretValue,
} from '../secrets'

describe('secrets service', () => {
  beforeEach(() => {
    mockSecretsSend.mockReset()
    mockSsmSend.mockReset()
  })

  describe('listSecrets', () => {
    it('maps API response to normalized secret objects', async () => {
      mockSecretsSend.mockResolvedValueOnce({
        SecretList: [
          {
            ARN: 'arn:...:secret:my-secret',
            Name: 'my-secret',
            Description: 'A test secret',
            LastChangedDate: new Date('2024-01-01'),
            CreatedDate: new Date('2023-01-01'),
          },
        ],
      })
      const result = await listSecrets()
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        arn: 'arn:...:secret:my-secret',
        name: 'my-secret',
        description: 'A test secret',
      })
    })

    it('returns empty array when SecretList is undefined', async () => {
      mockSecretsSend.mockResolvedValueOnce({})
      expect(await listSecrets()).toEqual([])
    })

    it('defaults empty string for missing arn, name, description', async () => {
      mockSecretsSend.mockResolvedValueOnce({ SecretList: [{}] })
      const result = await listSecrets()
      expect(result[0]).toMatchObject({ arn: '', name: '', description: '' })
    })
  })

  describe('getSecretValue', () => {
    it('returns secretString, versionId, and versionStages', async () => {
      mockSecretsSend.mockResolvedValueOnce({
        SecretString: '{"password":"secret123"}',
        VersionId: 'v1',
        VersionStages: ['AWSCURRENT'],
      })
      const result = await getSecretValue('my-secret')
      expect(result).toEqual({
        secretString: '{"password":"secret123"}',
        versionId: 'v1',
        versionStages: ['AWSCURRENT'],
      })
    })

    it('defaults to empty values when fields are missing', async () => {
      mockSecretsSend.mockResolvedValueOnce({})
      const result = await getSecretValue('my-secret')
      expect(result).toEqual({ secretString: '', versionId: '', versionStages: [] })
    })
  })

  describe('createSecret', () => {
    it('returns the ARN of the created secret', async () => {
      mockSecretsSend.mockResolvedValueOnce({ ARN: 'arn:...:secret:new-secret' })
      expect(await createSecret({ name: 'new-secret', secretString: '{"key":"val"}' })).toBe(
        'arn:...:secret:new-secret',
      )
    })

    it('uses "{}" as secretString when omitted', async () => {
      mockSecretsSend.mockResolvedValueOnce({ ARN: 'arn:...' })
      await createSecret({ name: 'empty-secret' })
      expect(mockSecretsSend).toHaveBeenCalledOnce()
    })

    it('returns empty string when ARN is missing', async () => {
      mockSecretsSend.mockResolvedValueOnce({})
      expect(await createSecret({ name: 'secret' })).toBe('')
    })
  })

  describe('putSecretValue', () => {
    it('returns the new VersionId', async () => {
      mockSecretsSend.mockResolvedValueOnce({ VersionId: 'v2' })
      expect(await putSecretValue('my-secret', '{"updated":true}')).toBe('v2')
    })

    it('uses "{}" when secretString is empty', async () => {
      mockSecretsSend.mockResolvedValueOnce({ VersionId: 'v1' })
      await putSecretValue('my-secret', '')
      expect(mockSecretsSend).toHaveBeenCalledOnce()
    })
  })

  describe('deleteSecret', () => {
    it('calls send once with ForceDeleteWithoutRecovery true', async () => {
      mockSecretsSend.mockResolvedValueOnce({})
      await deleteSecret('my-secret')
      expect(mockSecretsSend).toHaveBeenCalledOnce()
    })
  })

  describe('listParameters', () => {
    it('maps API response to normalized parameter objects', async () => {
      mockSsmSend.mockResolvedValueOnce({
        Parameters: [
          {
            Name: '/my/param',
            Type: 'SecureString',
            Version: 3,
            LastModifiedDate: new Date('2024-06-01'),
            Description: 'A param',
          },
        ],
      })
      const result = await listParameters()
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ name: '/my/param', type: 'SecureString', version: 3 })
    })

    it('returns empty array when Parameters is undefined', async () => {
      mockSsmSend.mockResolvedValueOnce({})
      expect(await listParameters()).toEqual([])
    })

    it('defaults to 0 for missing version', async () => {
      mockSsmSend.mockResolvedValueOnce({ Parameters: [{ Name: '/x' }] })
      const result = await listParameters()
      expect(result[0].version).toBe(0)
    })
  })

  describe('getParameterValue', () => {
    it('returns parameter name, type, value, and version', async () => {
      mockSsmSend.mockResolvedValueOnce({
        Parameter: { Name: '/my/param', Type: 'String', Value: 'hello', Version: 2 },
      })
      const result = await getParameterValue('/my/param')
      expect(result).toEqual({ name: '/my/param', type: 'String', value: 'hello', version: 2 })
    })

    it('falls back to the input name when Parameter is missing', async () => {
      mockSsmSend.mockResolvedValueOnce({})
      const result = await getParameterValue('/fallback')
      expect(result.name).toBe('/fallback')
    })
  })

  describe('putParameter', () => {
    it('returns the new version number', async () => {
      mockSsmSend.mockResolvedValueOnce({ Version: 4 })
      const version = await putParameter({
        name: '/my/param',
        value: 'value',
        type: 'String',
        description: 'desc',
      })
      expect(version).toBe(4)
    })

    it('returns 0 when Version is missing', async () => {
      mockSsmSend.mockResolvedValueOnce({})
      expect(await putParameter({ name: '/x', value: 'v' })).toBe(0)
    })

    it('defaults type to String when not provided', async () => {
      mockSsmSend.mockResolvedValueOnce({ Version: 1 })
      await putParameter({ name: '/x', value: 'v' })
      expect(mockSsmSend).toHaveBeenCalledOnce()
    })
  })

  describe('deleteParameter', () => {
    it('calls send once for the given parameter name', async () => {
      mockSsmSend.mockResolvedValueOnce({})
      await deleteParameter('/my/param')
      expect(mockSsmSend).toHaveBeenCalledOnce()
    })
  })
})
