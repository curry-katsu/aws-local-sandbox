import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLambdaLogs } from '../lambdaLogs'

describe('lambdaLogs service', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches logs with default tail size', async () => {
    const logs = [{ requestId: 'req-1', message: 'OK' }]
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(logs),
    })

    const result = await getLambdaLogs('my-function')
    expect(result).toEqual(logs)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/lambda/functions/my-function/logs?tail=200'),
    )
  })

  it('includes requestId in the query string when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
    await getLambdaLogs('my-function', { requestId: 'req-abc', tail: 50 })
    const url = vi.mocked(fetch).mock.calls[0][0]
    expect(url).toContain('requestId=req-abc')
    expect(url).toContain('tail=50')
  })

  it('omits requestId from query string when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
    await getLambdaLogs('my-function', { tail: 100 })
    const url = vi.mocked(fetch).mock.calls[0][0]
    expect(url).not.toContain('requestId')
  })

  it('encodes special characters in function name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
    await getLambdaLogs('my function/name')
    const url = vi.mocked(fetch).mock.calls[0][0]
    expect(url).toContain('my%20function%2Fname')
  })

  it('throws an error when the HTTP response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(getLambdaLogs('my-function')).rejects.toThrow('HTTP 503')
  })
})
