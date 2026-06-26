import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('aws config', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('exports region defaulting to us-east-1', async () => {
    const { region } = await import('../config')
    expect(region).toBe('us-east-1')
  })

  it('exports dummy accessKeyId', async () => {
    const { credentials } = await import('../config')
    expect(credentials.accessKeyId).toBe('test')
  })

  it('exports dummy secretAccessKey', async () => {
    const { credentials } = await import('../config')
    expect(credentials.secretAccessKey).toBe('test')
  })

  it('exports clientConfig with endpoint, region, and credentials', async () => {
    const { clientConfig } = await import('../config')
    expect(clientConfig).toMatchObject({
      endpoint: expect.any(String),
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    })
  })

  it('clientConfig endpoint is a non-empty string', async () => {
    const { clientConfig } = await import('../config')
    expect(clientConfig.endpoint.length).toBeGreaterThan(0)
  })

  it('exports s3ClientConfig with forcePathStyle true', async () => {
    const { s3ClientConfig } = await import('../config')
    expect(s3ClientConfig.forcePathStyle).toBe(true)
  })

  it('s3ClientConfig shares the same region and credentials as clientConfig', async () => {
    const { clientConfig, s3ClientConfig } = await import('../config')
    expect(s3ClientConfig.region).toBe(clientConfig.region)
    expect(s3ClientConfig.credentials).toEqual(clientConfig.credentials)
  })

  it('loads saved browser connection settings', async () => {
    window.localStorage.setItem(
      'aws-local-sandbox.browser-config',
      JSON.stringify({
        endpoint: 'http://localhost:14566/',
        debugBaseUrl: 'http://localhost:15180/debug/',
        region: 'ap-northeast-1',
      }),
    )

    const { debugBaseUrl, endpoint, region } = await import('../config')
    expect(endpoint).toBe('http://localhost:14566')
    expect(debugBaseUrl).toBe('http://localhost:15180/debug')
    expect(region).toBe('ap-northeast-1')
  })

  it('saves and resets browser connection settings', async () => {
    const { loadBrowserConfig, resetBrowserConfig, saveBrowserConfig } = await import('../config')

    saveBrowserConfig({
      endpoint: 'http://localhost:24566/',
      debugBaseUrl: 'http://localhost:25180/debug/',
      region: 'us-west-2',
    })
    expect(loadBrowserConfig()).toEqual({
      endpoint: 'http://localhost:24566',
      debugBaseUrl: 'http://localhost:25180/debug',
      region: 'us-west-2',
    })

    resetBrowserConfig()
    expect(window.localStorage.getItem('aws-local-sandbox.browser-config')).toBeNull()
  })
})
