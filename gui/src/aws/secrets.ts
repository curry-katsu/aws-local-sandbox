import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  ListSecretsCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import {
  DeleteParameterCommand,
  DescribeParametersCommand,
  GetParameterCommand,
  PutParameterCommand,
  SSMClient,
} from '@aws-sdk/client-ssm'
import { clientConfig } from './config'

const secretsManager = new SecretsManagerClient(clientConfig)
const ssm = new SSMClient(clientConfig)

export async function listSecrets() {
  const result = await secretsManager.send(new ListSecretsCommand({ MaxResults: 100 }))
  return (result.SecretList || []).map((secret) => ({
    arn: secret.ARN || '',
    name: secret.Name || '',
    description: secret.Description || '',
    lastChangedDate: secret.LastChangedDate,
    createdDate: secret.CreatedDate,
  }))
}

export async function getSecretValue(secretId) {
  const result = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretId }))
  return {
    secretString: result.SecretString || '',
    versionId: result.VersionId || '',
    versionStages: result.VersionStages || [],
  }
}

export async function createSecret({ name, description, secretString }) {
  const result = await secretsManager.send(
    new CreateSecretCommand({
      Name: name,
      Description: description || undefined,
      SecretString: secretString || '{}',
    }),
  )
  return result.ARN || ''
}

export async function putSecretValue(secretId, secretString) {
  const result = await secretsManager.send(
    new PutSecretValueCommand({
      SecretId: secretId,
      SecretString: secretString || '{}',
    }),
  )
  return result.VersionId || ''
}

export async function deleteSecret(secretId) {
  await secretsManager.send(
    new DeleteSecretCommand({
      SecretId: secretId,
      ForceDeleteWithoutRecovery: true,
    }),
  )
}

export async function listParameters() {
  const result = await ssm.send(new DescribeParametersCommand({ MaxResults: 50 }))
  return (result.Parameters || []).map((parameter) => ({
    name: parameter.Name || '',
    type: parameter.Type || '',
    version: parameter.Version || 0,
    lastModifiedDate: parameter.LastModifiedDate,
    description: parameter.Description || '',
  }))
}

export async function getParameterValue(name, withDecryption = true) {
  const result = await ssm.send(
    new GetParameterCommand({
      Name: name,
      WithDecryption: withDecryption,
    }),
  )
  return {
    name: result.Parameter?.Name || name,
    type: result.Parameter?.Type || '',
    value: result.Parameter?.Value || '',
    version: result.Parameter?.Version || 0,
  }
}

export async function putParameter({ name, value, type, description, overwrite = true }) {
  const result = await ssm.send(
    new PutParameterCommand({
      Name: name,
      Value: value || '',
      Type: type || 'String',
      Description: description || undefined,
      Overwrite: overwrite,
    }),
  )
  return result.Version || 0
}

export async function deleteParameter(name) {
  await ssm.send(new DeleteParameterCommand({ Name: name }))
}
