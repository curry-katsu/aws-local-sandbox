import {
  GetFunctionCommand,
  GetLayerVersionCommand,
  InvokeCommand,
  LambdaClient,
  ListFunctionsCommand,
  ListLayersCommand,
  ListLayerVersionsCommand,
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

export async function listLambdaLayers() {
  const layers = []
  let marker

  do {
    const result = await lambda.send(
      new ListLayersCommand({
        Marker: marker,
        MaxItems: 50,
      }),
    )
    layers.push(...(result.Layers || []))
    marker = result.NextMarker
  } while (marker)

  return layers
}

export async function listLambdaLayerVersions(layerName) {
  const versions = []
  let marker

  do {
    const result = await lambda.send(
      new ListLayerVersionsCommand({
        LayerName: layerName,
        Marker: marker,
        MaxItems: 50,
      }),
    )
    versions.push(...(result.LayerVersions || []))
    marker = result.NextMarker
  } while (marker)

  return versions
}

export async function getLambdaLayerVersion(layerName, versionNumber) {
  return lambda.send(
    new GetLayerVersionCommand({
      LayerName: layerName,
      VersionNumber: versionNumber,
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
