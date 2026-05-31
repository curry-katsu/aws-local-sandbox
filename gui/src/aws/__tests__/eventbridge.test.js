import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEventBridgeSend = vi.hoisted(() => vi.fn())
const mockLambdaSend = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn(() => ({ send: mockEventBridgeSend })),
  ListRulesCommand: vi.fn(),
  ListTargetsByRuleCommand: vi.fn(),
}))

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn(() => ({ send: mockLambdaSend })),
  InvokeCommand: vi.fn(),
}))

vi.mock('../config', () => ({
  clientConfig: {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  },
}))

import { invokeLambdaTarget, loadEventBridgeRule } from '../eventbridge'

const RULE_ARN = 'arn:aws:events:us-east-1:000000000000:rule/my-rule'
const LAMBDA_ARN = 'arn:aws:lambda:us-east-1:000000000000:function:my-function'

describe('eventbridge service', () => {
  beforeEach(() => {
    mockEventBridgeSend.mockReset()
    mockLambdaSend.mockReset()
  })

  describe('loadEventBridgeRule', () => {
    it('returns the matched rule and its targets', async () => {
      const rule = { Name: 'my-rule', Arn: RULE_ARN }
      const targets = [{ Id: 'target-1', Arn: LAMBDA_ARN }]
      mockEventBridgeSend
        .mockResolvedValueOnce({ Rules: [rule] })
        .mockResolvedValueOnce({ Targets: targets })
      const result = await loadEventBridgeRule('my-rule')
      expect(result.rule).toEqual(rule)
      expect(result.targets).toEqual(targets)
    })

    it('falls back to the first rule when the named rule is not found', async () => {
      const otherRule = { Name: 'other-rule', Arn: 'arn:...' }
      mockEventBridgeSend
        .mockResolvedValueOnce({ Rules: [otherRule] })
        .mockResolvedValueOnce({ Targets: [] })
      const result = await loadEventBridgeRule('my-rule')
      expect(result.rule.Name).toBe('other-rule')
    })

    it('returns empty targets when Targets is undefined', async () => {
      mockEventBridgeSend
        .mockResolvedValueOnce({ Rules: [{ Name: 'my-rule' }] })
        .mockResolvedValueOnce({})
      const result = await loadEventBridgeRule('my-rule')
      expect(result.targets).toEqual([])
    })

    it('throws when no rules are found', async () => {
      mockEventBridgeSend.mockResolvedValueOnce({ Rules: [] })
      await expect(loadEventBridgeRule('missing-rule')).rejects.toThrow('missing-rule')
    })

    it('throws when Rules is undefined', async () => {
      mockEventBridgeSend.mockResolvedValueOnce({})
      await expect(loadEventBridgeRule('missing-rule')).rejects.toThrow('missing-rule')
    })
  })

  describe('invokeLambdaTarget', () => {
    it('extracts function name from ARN and invokes it', async () => {
      const responsePayload = new TextEncoder().encode(JSON.stringify({ status: 'ok' }))
      mockLambdaSend.mockResolvedValueOnce({
        StatusCode: 200,
        ExecutedVersion: '$LATEST',
        FunctionError: undefined,
        Payload: responsePayload,
      })
      const result = await invokeLambdaTarget(LAMBDA_ARN)
      expect(result.functionName).toBe('my-function')
      expect(result.result.statusCode).toBe(200)
      expect(result.result.payload).toEqual({ status: 'ok' })
    })

    it('returns null payload when Lambda response Payload is empty', async () => {
      mockLambdaSend.mockResolvedValueOnce({ StatusCode: 200, Payload: undefined })
      const result = await invokeLambdaTarget(LAMBDA_ARN)
      expect(result.result.payload).toBeNull()
    })

    it('returns raw string payload when response is not valid JSON', async () => {
      const responsePayload = new TextEncoder().encode('not-json')
      mockLambdaSend.mockResolvedValueOnce({ StatusCode: 200, Payload: responsePayload })
      const result = await invokeLambdaTarget(LAMBDA_ARN)
      expect(result.result.payload).toBe('not-json')
    })

    it('throws when ARN does not contain ":function:"', async () => {
      await expect(invokeLambdaTarget('arn:aws:events:us-east-1:000000000000:rule/my-rule')).rejects.toThrow(
        'No Lambda target ARN',
      )
    })
  })
})
