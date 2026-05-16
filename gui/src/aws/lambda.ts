import {
  GetFunctionCommand,
  InvokeCommand,
  LambdaClient,
  ListFunctionsCommand,
} from '@aws-sdk/client-lambda'
import { clientConfig } from './config'

const lambda = new LambdaClient(clientConfig)

export async function listLambdaFunctions() {
  const functions = []
  let marker

  do {
    const result = await lambda.send(
      new ListFunctionsCommand({
        Marker: marker,
        MaxItems: 50,
      }),
    )
    functions.push(...(result.Functions || []))
    marker = result.NextMarker
  } while (marker)

  return functions
}

export async function getLambdaFunction(functionName) {
  return lambda.send(
    new GetFunctionCommand({
      FunctionName: functionName,
    }),
  )
}

export async function invokeLambdaFunction(functionName, payloadValue) {
  const payload = JSON.stringify(parseJson(payloadValue))
  const result = await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: new TextEncoder().encode(payload),
    }),
  )

  const payloadText = result.Payload ? new TextDecoder().decode(result.Payload) : ''

  return {
    statusCode: result.StatusCode,
    executedVersion: result.ExecutedVersion,
    functionError: result.FunctionError,
    payload: parseJson(payloadText),
  }
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
