import { Amplify } from 'aws-amplify'
import { fetchAuthSession, signIn, signOut } from 'aws-amplify/auth'
import {
  CognitoIdentityProviderClient,
  ListUserPoolClientsCommand,
  ListUserPoolsCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { credentials, endpoint, region } from './config'

const defaultUserPoolName = import.meta.env.VITE_COGNITO_USER_POOL_NAME || 'aws-local-sandbox-user-pool'
const defaultClientName =
  import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_NAME || 'aws-local-sandbox-user-pool-client'

export const cognitoDefaults = {
  endpoint,
  region,
  userPoolName: defaultUserPoolName,
  clientName: defaultClientName,
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || '',
  username: import.meta.env.VITE_COGNITO_USERNAME || 'sandbox-user@example.com',
  password: import.meta.env.VITE_COGNITO_PASSWORD || 'Sandbox123',
}

export async function discoverCognitoResources(config) {
  const client = new CognitoIdentityProviderClient({
    endpoint: config.endpoint,
    region: config.region,
    credentials,
  })
  const pools = await client.send(new ListUserPoolsCommand({ MaxResults: 60 }))
  const pool =
    (pools.UserPools || []).find((candidate) => candidate.Name === defaultUserPoolName) ||
    (pools.UserPools || [])[0]

  if (!pool?.Id) {
    throw new Error('No Cognito user pools were found in Floci.')
  }

  const clients = await client.send(
    new ListUserPoolClientsCommand({
      UserPoolId: pool.Id,
      MaxResults: 60,
    }),
  )
  const userPoolClient =
    (clients.UserPoolClients || []).find((candidate) => candidate.ClientName === defaultClientName) ||
    (clients.UserPoolClients || [])[0]

  if (!userPoolClient?.ClientId) {
    throw new Error(`No Cognito user pool clients were found for ${pool.Id}.`)
  }

  return {
    poolName: pool.Name,
    clientName: userPoolClient.ClientName,
    userPoolId: pool.Id,
    userPoolClientId: userPoolClient.ClientId,
  }
}

export async function signInToCognito(config) {
  configureAmplify(config)
  await signOut().catch(() => undefined)

  const result = await signIn({
    username: config.username,
    password: config.password,
    options: {
      authFlowType: 'USER_PASSWORD_AUTH',
    },
  })

  if (!result.isSignedIn) {
    return {
      signedIn: false,
      nextStep: result.nextStep?.signInStep || 'unknown',
      tokens: {
        idToken: '',
        accessToken: '',
      },
    }
  }

  return {
    signedIn: true,
    nextStep: '',
    tokens: await loadCognitoSession(),
  }
}

export async function signOutFromCognito(config) {
  configureAmplify(config)
  await signOut()
}

async function loadCognitoSession() {
  const session = await fetchAuthSession()
  return {
    idToken: session.tokens?.idToken?.toString() || '',
    accessToken: session.tokens?.accessToken?.toString() || '',
  }
}

function configureAmplify(config) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        userPoolEndpoint: config.endpoint,
        loginWith: {
          email: true,
        },
      },
    },
  })
}

