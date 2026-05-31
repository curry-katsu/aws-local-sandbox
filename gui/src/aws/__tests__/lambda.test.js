import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn(() => ({ send: mockSend })),
  GetFunctionCommand: vi.fn(),
  InvokeCommand: vi.fn(),
  ListFunctionsCommand: vi.fn(),
}))

vi.mock('../config', () => ({
  clientConfig: {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  },
}))

import { getLambdaFunction, invokeLambdaFunction, listLambdaFunctions } from '../lambda'

describe('lambda service', () => {
  beforeEach(() => mockSend.mockReset())

  describe('listLambdaFunctions', () => {
    it('returns functions from a single page', async () => {
      const fns = [{ FunctionName: 'fn-a' }, { FunctionName: 'fn-b' }]
      mockSend.mockResolvedValueOnce({ Functions: fns, NextMarker: undefined })
      expect(await listLambdaFunctions()).toEqual(fns)
    })

    it('paginates when NextMarker is present', async () => {
      mockSend
        .mockResolvedValueOnce({ Functions: [{ FunctionName: 'fn-a' }], NextMarker: 'token-1' })
        .mockResolvedValueOnce({ Functions: [{ FunctionName: 'fn-b' }], NextMarker: undefined })
      const result = await listLambdaFunctions()
      expect(result).toHaveLength(2)
      expect(result[0].FunctionName).toBe('fn-a')
      expect(result[1].FunctionName).toBe('fn-b')
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('returns empty array when Functions is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await listLambdaFunctions()).toEqual([])
    })
  })

  describe('getLambdaFunction', () => {
    it('returns the full SDK response for the given function', async () => {
      const detail = { Configuration: { FunctionName: 'my-fn', Runtime: 'nodejs20.x' } }
      mockSend.mockResolvedValueOnce(detail)
      expect(await getLambdaFunction('my-fn')).toEqual(detail)
    })
  })

  describe('invokeLambdaFunction', () => {
    it('parses JSON payload and returns structured result', async () => {
      const responsePayload = new TextEncoder().encode(JSON.stringify({ ok: true }))
      mockSend.mockResolvedValueOnce({
        StatusCode: 200,
        ExecutedVersion: '$LATEST',
        FunctionError: undefined,
        Payload: responsePayload,
      })
      const result = await invokeLambdaFunction('my-fn', '{"key":"value"}')
      expect(result.statusCode).toBe(200)
      expect(result.payload).toEqual({ ok: true })
    })

    it('returns null payload when response Payload is empty', async () => {
      mockSend.mockResolvedValueOnce({ StatusCode: 200, Payload: undefined })
      const result = await invokeLambdaFunction('my-fn', '{}')
      expect(result.payload).toBeNull()
    })

    it('handles non-JSON string payload input', async () => {
      const responsePayload = new TextEncoder().encode('"plain string"')
      mockSend.mockResolvedValueOnce({ StatusCode: 200, Payload: responsePayload })
      const result = await invokeLambdaFunction('my-fn', 'not-json')
      expect(result.statusCode).toBe(200)
    })

    it('returns raw string when response payload is not valid JSON', async () => {
      const responsePayload = new TextEncoder().encode('not-json')
      mockSend.mockResolvedValueOnce({ StatusCode: 200, Payload: responsePayload })
      const result = await invokeLambdaFunction('my-fn', '{}')
      expect(result.payload).toBe('not-json')
    })

    it('returns null when input payload is empty string', async () => {
      const responsePayload = new TextEncoder().encode('null')
      mockSend.mockResolvedValueOnce({ StatusCode: 200, Payload: responsePayload })
      const result = await invokeLambdaFunction('my-fn', '')
      expect(result.statusCode).toBe(200)
    })

    it('includes functionError in the result when Lambda returns an error', async () => {
      const responsePayload = new TextEncoder().encode(JSON.stringify({ errorMessage: 'oops' }))
      mockSend.mockResolvedValueOnce({
        StatusCode: 200,
        ExecutedVersion: '$LATEST',
        FunctionError: 'Handled',
        Payload: responsePayload,
      })
      const result = await invokeLambdaFunction('my-fn', '{}')
      expect(result.functionError).toBe('Handled')
      expect(result.payload).toEqual({ errorMessage: 'oops' })
    })
  })
})
