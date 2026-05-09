import {
  DescribeExecutionCommand,
  DescribeStateMachineCommand,
  GetExecutionHistoryCommand,
  ListStateMachinesCommand,
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn'
import { clientConfig } from './config'

const sfn = new SFNClient(clientConfig)

export const defaultStateMachineName =
  import.meta.env.VITE_STEPFUNCTIONS_STATE_MACHINE_NAME ||
  'aws-local-sandbox-stepfunctions-two-lambdas'

export async function loadStateMachineByName(stateMachineName) {
  const listResult = await sfn.send(new ListStateMachinesCommand({ maxResults: 100 }))
  const detected =
    (listResult.stateMachines || []).find((candidate) => candidate.name === stateMachineName) ||
    (listResult.stateMachines || [])[0]

  if (!detected?.stateMachineArn) {
    throw new Error(`No Step Functions state machine was found for ${stateMachineName}.`)
  }

  const detail = await sfn.send(
    new DescribeStateMachineCommand({
      stateMachineArn: detected.stateMachineArn,
    }),
  )

  return {
    stateMachine: detected,
    stateMachineArn: detected.stateMachineArn,
    detail,
    definition: parseJson(detail.definition),
  }
}

export async function startStateMachineExecution(stateMachineArn, inputValue) {
  const input = JSON.stringify(parseJson(inputValue))
  const executionName = `gui-${Date.now()}`
  const startResult = await sfn.send(
    new StartExecutionCommand({
      stateMachineArn,
      name: executionName,
      input,
    }),
  )

  const execution = await waitForExecution(startResult.executionArn)
  const historyResult = await sfn.send(
    new GetExecutionHistoryCommand({
      executionArn: startResult.executionArn,
    }),
  )

  return {
    executionName,
    execution,
    output: parseJson(execution.output),
    historyEvents: historyResult.events || [],
  }
}

async function waitForExecution(executionArn) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await sfn.send(
      new DescribeExecutionCommand({
        executionArn,
      }),
    )

    if (result.status !== 'RUNNING') {
      return result
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return sfn.send(
    new DescribeExecutionCommand({
      executionArn,
    }),
  )
}

function parseJson(value) {
  if (!value) return null
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

