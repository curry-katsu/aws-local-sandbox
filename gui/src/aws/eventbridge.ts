import {
  EventBridgeClient,
  ListRulesCommand,
  ListTargetsByRuleCommand,
} from '@aws-sdk/client-eventbridge'
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import { clientConfig } from './config'

const eventbridge = new EventBridgeClient(clientConfig)
const lambda = new LambdaClient(clientConfig)

export const defaultEventBridgeRuleName =
  import.meta.env.VITE_EVENTBRIDGE_RULE_NAME || 'aws-local-sandbox-daily-noon-jst'

export async function loadEventBridgeRule(ruleName) {
  const rulesResult = await eventbridge.send(
    new ListRulesCommand({
      NamePrefix: ruleName,
      Limit: 20,
    }),
  )
  const detectedRule =
    (rulesResult.Rules || []).find((candidate) => candidate.Name === ruleName) ||
    (rulesResult.Rules || [])[0]

  if (!detectedRule?.Name) {
    throw new Error(`No EventBridge rule was found for ${ruleName}.`)
  }

  const targetResult = await eventbridge.send(
    new ListTargetsByRuleCommand({
      Rule: detectedRule.Name,
    }),
  )

  return {
    rule: detectedRule,
    targets: targetResult.Targets || [],
  }
}

export async function invokeLambdaTarget(lambdaTargetArn) {
  const functionName = lambdaTargetArn.split(':function:')[1]
  if (!functionName) {
    throw new Error('No Lambda target ARN was found on the EventBridge rule.')
  }

  const result = await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: new TextEncoder().encode(
        JSON.stringify({
          source: 'gui-verification',
          detail: {
            trigger: 'EventBridgeVerifier',
          },
        }),
      ),
    }),
  )

  const payloadText = result.Payload ? new TextDecoder().decode(result.Payload) : ''
  return {
    functionName,
    result: {
      statusCode: result.StatusCode,
      executedVersion: result.ExecutedVersion,
      functionError: result.FunctionError,
      payload: parseJson(payloadText),
    },
  }
}

function parseJson(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

