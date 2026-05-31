import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: vi.fn(() => ({ send: mockSend })),
  ListUserPoolClientsCommand: vi.fn(),
  ListUserPoolsCommand: vi.fn(),
}))

vi.mock('aws-amplify', () => ({
  Amplify: { configure: vi.fn() },
}))

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../config', () => ({
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
}))

import { Amplify } from 'aws-amplify'
import { fetchAuthSession, signIn, signOut } from 'aws-amplify/auth'
import { cognitoDefaults, discoverCognitoResources, signInToCognito, signOutFromCognito } from '../cognito'

const CONFIG = {
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
  userPoolId: 'us-east-1_abc123',
  userPoolClientId: 'client-abc',
  username: 'user@example.com',
  password: 'Password123',
}

describe('cognito service', () => {
  beforeEach(() => {
    mockSend.mockReset()
    vi.mocked(signIn).mockReset()
    vi.mocked(signOut).mockReset()
    vi.mocked(fetchAuthSession).mockReset()
    vi.mocked(Amplify.configure).mockReset()
  })

  describe('cognitoDefaults', () => {
    it('exports default user pool name', () => {
      expect(cognitoDefaults.userPoolName).toBeTruthy()
    })

    it('exports default client name', () => {
      expect(cognitoDefaults.clientName).toBeTruthy()
    })
  })

  describe('discoverCognitoResources', () => {
    it('finds pool by name and client by name', async () => {
      mockSend
        .mockResolvedValueOnce({
          UserPools: [{ Id: 'pool-1', Name: 'aws-local-sandbox-user-pool' }],
        })
        .mockResolvedValueOnce({
          UserPoolClients: [
            { ClientId: 'client-1', ClientName: 'aws-local-sandbox-user-pool-client' },
          ],
        })

      const result = await discoverCognitoResources(CONFIG)
      expect(result.userPoolId).toBe('pool-1')
      expect(result.userPoolClientId).toBe('client-1')
      expect(result.poolName).toBe('aws-local-sandbox-user-pool')
    })

    it('falls back to the first pool when the named pool is not found', async () => {
      mockSend
        .mockResolvedValueOnce({ UserPools: [{ Id: 'other-pool', Name: 'other-name' }] })
        .mockResolvedValueOnce({ UserPoolClients: [{ ClientId: 'c1', ClientName: 'client' }] })

      const result = await discoverCognitoResources(CONFIG)
      expect(result.userPoolId).toBe('other-pool')
    })

    it('falls back to the first client when the named client is not found', async () => {
      mockSend
        .mockResolvedValueOnce({ UserPools: [{ Id: 'pool-1', Name: 'my-pool' }] })
        .mockResolvedValueOnce({ UserPoolClients: [{ ClientId: 'first-client', ClientName: 'other-client' }] })

      const result = await discoverCognitoResources(CONFIG)
      expect(result.userPoolClientId).toBe('first-client')
    })

    it('throws when no user pools are found', async () => {
      mockSend.mockResolvedValueOnce({ UserPools: [] })
      await expect(discoverCognitoResources(CONFIG)).rejects.toThrow('No Cognito user pools')
    })

    it('throws when UserPools is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      await expect(discoverCognitoResources(CONFIG)).rejects.toThrow('No Cognito user pools')
    })

    it('throws when no clients are found for the pool', async () => {
      mockSend
        .mockResolvedValueOnce({ UserPools: [{ Id: 'pool-1', Name: 'my-pool' }] })
        .mockResolvedValueOnce({ UserPoolClients: [] })
      await expect(discoverCognitoResources(CONFIG)).rejects.toThrow('No Cognito user pool clients')
    })
  })

  describe('signInToCognito', () => {
    it('configures Amplify before signing in', async () => {
      vi.mocked(signOut).mockResolvedValue(undefined)
      vi.mocked(signIn).mockResolvedValue({ isSignedIn: true })
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: { toString: () => 'id-token' },
          accessToken: { toString: () => 'access-token' },
        },
      })

      await signInToCognito(CONFIG)
      expect(Amplify.configure).toHaveBeenCalledOnce()
    })

    it('returns signedIn true with tokens when sign-in succeeds', async () => {
      vi.mocked(signOut).mockResolvedValue(undefined)
      vi.mocked(signIn).mockResolvedValue({ isSignedIn: true })
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: { toString: () => 'id-token-value' },
          accessToken: { toString: () => 'access-token-value' },
        },
      })

      const result = await signInToCognito(CONFIG)
      expect(result.signedIn).toBe(true)
      expect(result.tokens.idToken).toBe('id-token-value')
      expect(result.tokens.accessToken).toBe('access-token-value')
    })

    it('returns signedIn false with nextStep when additional step is required', async () => {
      vi.mocked(signOut).mockResolvedValue(undefined)
      vi.mocked(signIn).mockResolvedValue({
        isSignedIn: false,
        nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_TOTP_CODE' },
      })

      const result = await signInToCognito(CONFIG)
      expect(result.signedIn).toBe(false)
      expect(result.nextStep).toBe('CONFIRM_SIGN_IN_WITH_TOTP_CODE')
      expect(result.tokens.idToken).toBe('')
    })

    it('returns "unknown" nextStep when signInStep is missing', async () => {
      vi.mocked(signOut).mockResolvedValue(undefined)
      vi.mocked(signIn).mockResolvedValue({ isSignedIn: false, nextStep: {} })

      const result = await signInToCognito(CONFIG)
      expect(result.nextStep).toBe('unknown')
    })

    it('silently ignores signOut errors before signing in', async () => {
      vi.mocked(signOut).mockRejectedValue(new Error('Already signed out'))
      vi.mocked(signIn).mockResolvedValue({ isSignedIn: true })
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: { toString: () => 'tok' },
          accessToken: { toString: () => 'tok' },
        },
      })

      await expect(signInToCognito(CONFIG)).resolves.toBeDefined()
    })

    it('returns empty token strings when fetchAuthSession has no tokens', async () => {
      vi.mocked(signOut).mockResolvedValue(undefined)
      vi.mocked(signIn).mockResolvedValue({ isSignedIn: true })
      vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: undefined })

      const result = await signInToCognito(CONFIG)
      expect(result.tokens.idToken).toBe('')
      expect(result.tokens.accessToken).toBe('')
    })
  })

  describe('signOutFromCognito', () => {
    it('configures Amplify and calls signOut', async () => {
      vi.mocked(signOut).mockResolvedValue(undefined)
      await signOutFromCognito(CONFIG)
      expect(Amplify.configure).toHaveBeenCalledOnce()
      expect(signOut).toHaveBeenCalledOnce()
    })
  })
})
