import { describe, expect, it } from 'vitest'
import { clientConfig, credentials, region, s3ClientConfig } from '../config'

describe('aws config', () => {
  it('exports region defaulting to us-east-1', () => {
    expect(region).toBe('us-east-1')
  })

  it('exports dummy accessKeyId', () => {
    expect(credentials.accessKeyId).toBe('test')
  })

  it('exports dummy secretAccessKey', () => {
    expect(credentials.secretAccessKey).toBe('test')
  })

  it('exports clientConfig with endpoint, region, and credentials', () => {
    expect(clientConfig).toMatchObject({
      endpoint: expect.any(String),
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    })
  })

  it('clientConfig endpoint is a non-empty string', () => {
    expect(clientConfig.endpoint.length).toBeGreaterThan(0)
  })

  it('exports s3ClientConfig with forcePathStyle true', () => {
    expect(s3ClientConfig.forcePathStyle).toBe(true)
  })

  it('s3ClientConfig shares the same region and credentials as clientConfig', () => {
    expect(s3ClientConfig.region).toBe(clientConfig.region)
    expect(s3ClientConfig.credentials).toEqual(clientConfig.credentials)
  })
})
