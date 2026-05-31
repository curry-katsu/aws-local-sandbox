import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: vi.fn(() => ({ send: mockSend })),
  DescribeExecutionCommand: vi.fn(),
  DescribeStateMachineCommand: vi.fn(),
  GetExecutionHistoryCommand: vi.fn(),
  ListStateMachinesCommand: vi.fn(),
  StartExecutionCommand: vi.fn(),
}))

vi.mock('../config', () => ({
  clientConfig: {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  },
}))

import { loadStateMachineByName, startStateMachineExecution } from '../stepfunctions'

const MACHINE_ARN = 'arn:aws:states:us-east-1:000000000000:stateMachine:my-machine'
const EXECUTION_ARN = 'arn:aws:states:us-east-1:000000000000:execution:my-machine:exec-1'

describe('stepfunctions service', () => {
  beforeEach(() => mockSend.mockReset())

  describe('loadStateMachineByName', () => {
    it('returns the matched state machine and its definition', async () => {
      const definition = { Comment: 'My state machine', StartAt: 'First' }
      mockSend
        .mockResolvedValueOnce({
          stateMachines: [{ name: 'my-machine', stateMachineArn: MACHINE_ARN }],
        })
        .mockResolvedValueOnce({ definition: JSON.stringify(definition), stateMachineArn: MACHINE_ARN })

      const result = await loadStateMachineByName('my-machine')
      expect(result.stateMachineArn).toBe(MACHINE_ARN)
      expect(result.definition).toEqual(definition)
    })

    it('falls back to the first machine when the named one is not found', async () => {
      mockSend
        .mockResolvedValueOnce({
          stateMachines: [{ name: 'other-machine', stateMachineArn: 'arn:...:other' }],
        })
        .mockResolvedValueOnce({ definition: null })

      const result = await loadStateMachineByName('my-machine')
      expect(result.stateMachineArn).toBe('arn:...:other')
    })

    it('parses JSON definition string', async () => {
      mockSend
        .mockResolvedValueOnce({ stateMachines: [{ name: 'my-machine', stateMachineArn: MACHINE_ARN }] })
        .mockResolvedValueOnce({ definition: '{"StartAt":"Step1","States":{}}' })

      const result = await loadStateMachineByName('my-machine')
      expect(result.definition).toEqual({ StartAt: 'Step1', States: {} })
    })

    it('returns null definition when definition string is missing', async () => {
      mockSend
        .mockResolvedValueOnce({ stateMachines: [{ name: 'my-machine', stateMachineArn: MACHINE_ARN }] })
        .mockResolvedValueOnce({})

      const result = await loadStateMachineByName('my-machine')
      expect(result.definition).toBeNull()
    })

    it('throws when no state machines are found', async () => {
      mockSend.mockResolvedValueOnce({ stateMachines: [] })
      await expect(loadStateMachineByName('missing-machine')).rejects.toThrow('missing-machine')
    })

    it('throws when stateMachines is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      await expect(loadStateMachineByName('missing-machine')).rejects.toThrow('missing-machine')
    })
  })

  describe('startStateMachineExecution', () => {
    it('returns execution result when execution completes immediately', async () => {
      mockSend
        .mockResolvedValueOnce({ executionArn: EXECUTION_ARN }) // StartExecution
        .mockResolvedValueOnce({ status: 'SUCCEEDED', output: '{"result":42}' }) // DescribeExecution
        .mockResolvedValueOnce({ events: [{ id: 1, type: 'ExecutionStarted' }] }) // GetExecutionHistory

      const result = await startStateMachineExecution(MACHINE_ARN, '{"input":1}')
      expect(result.execution.status).toBe('SUCCEEDED')
      expect(result.output).toEqual({ result: 42 })
      expect(result.historyEvents).toHaveLength(1)
    })

    it('polls until execution leaves RUNNING state', async () => {
      vi.useFakeTimers()
      mockSend
        .mockResolvedValueOnce({ executionArn: EXECUTION_ARN }) // StartExecution
        .mockResolvedValueOnce({ status: 'RUNNING' })           // DescribeExecution #1
        .mockResolvedValueOnce({ status: 'SUCCEEDED', output: '"done"' }) // DescribeExecution #2
        .mockResolvedValueOnce({ events: [] })                  // GetExecutionHistory

      const promise = startStateMachineExecution(MACHINE_ARN, '{}')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.execution.status).toBe('SUCCEEDED')
      expect(result.output).toBe('done')
      vi.useRealTimers()
    })

    it('returns null output when execution output is missing', async () => {
      mockSend
        .mockResolvedValueOnce({ executionArn: EXECUTION_ARN })
        .mockResolvedValueOnce({ status: 'FAILED' })
        .mockResolvedValueOnce({ events: [] })

      const result = await startStateMachineExecution(MACHINE_ARN, '{}')
      expect(result.output).toBeNull()
    })

    it('parses non-JSON string input gracefully', async () => {
      mockSend
        .mockResolvedValueOnce({ executionArn: EXECUTION_ARN })
        .mockResolvedValueOnce({ status: 'SUCCEEDED', output: 'null' })
        .mockResolvedValueOnce({ events: [] })

      await expect(startStateMachineExecution(MACHINE_ARN, 'not-json')).resolves.toBeDefined()
    })

    it('returns empty historyEvents when events is undefined', async () => {
      mockSend
        .mockResolvedValueOnce({ executionArn: EXECUTION_ARN })
        .mockResolvedValueOnce({ status: 'SUCCEEDED', output: 'null' })
        .mockResolvedValueOnce({})

      const result = await startStateMachineExecution(MACHINE_ARN, '{}')
      expect(result.historyEvents).toEqual([])
    })
  })
})
