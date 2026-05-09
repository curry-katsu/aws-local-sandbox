<template>
  <v-sheet border rounded="lg">
    <div class="auth-header">
      <div>
        <h2 class="text-h6">Cognito Login</h2>
        <p class="text-body-2 text-medium-emphasis ma-0">
          Vue and Amplify sign in against the local Floci Cognito endpoint.
        </p>
      </div>
      <div class="auth-actions">
        <v-btn
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-cloud-search-outline"
          :loading="discovering"
          @click="discoverCognito"
        >
          Detect
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-login" :loading="signingIn" @click="login">
          Sign in
        </v-btn>
      </div>
    </div>

    <v-divider />

    <div class="auth-grid">
      <div class="auth-form">
        <v-text-field
          v-model="form.endpoint"
          label="Endpoint"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
        <v-text-field
          v-model="form.region"
          label="Region"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
        <v-text-field
          v-model="form.userPoolId"
          label="User pool ID"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
        <v-text-field
          v-model="form.userPoolClientId"
          label="User pool client ID"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
        <v-text-field
          v-model="form.username"
          label="Username"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
          autocomplete="username"
        />
        <v-text-field
          v-model="form.password"
          label="Password"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
          :type="showPassword ? 'text' : 'password'"
          :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
          autocomplete="current-password"
          @click:append-inner="showPassword = !showPassword"
        />

        <v-alert v-if="error" type="error" variant="tonal" density="comfortable">
          {{ error }}
        </v-alert>
        <v-alert v-if="statusMessage" type="info" variant="tonal" density="comfortable">
          {{ statusMessage }}
        </v-alert>
      </div>

      <div class="auth-result">
        <div class="result-toolbar">
          <div>
            <div class="text-caption text-medium-emphasis">Amplify session</div>
            <div class="text-body-2 font-weight-medium">{{ sessionState }}</div>
          </div>
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-logout"
            :disabled="!signedIn"
            @click="logout"
          >
            Sign out
          </v-btn>
        </div>

        <v-table density="compact" class="token-table">
          <tbody>
            <tr>
              <th>ID token</th>
              <td>{{ tokenPreview(tokens.idToken) }}</td>
            </tr>
            <tr>
              <th>Access token</th>
              <td>{{ tokenPreview(tokens.accessToken) }}</td>
            </tr>
          </tbody>
        </v-table>

        <div class="jwt-panels">
          <v-expansion-panels variant="accordion">
            <v-expansion-panel title="ID token payload">
              <v-expansion-panel-text>
                <pre>{{ formatJson(decoded.idToken) }}</pre>
              </v-expansion-panel-text>
            </v-expansion-panel>
            <v-expansion-panel title="Access token payload">
              <v-expansion-panel-text>
                <pre>{{ formatJson(decoded.accessToken) }}</pre>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>
      </div>
    </div>
  </v-sheet>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  cognitoDefaults,
  discoverCognitoResources,
  signInToCognito,
  signOutFromCognito,
} from '../aws/cognito'

const form = reactive({
  endpoint: cognitoDefaults.endpoint,
  region: cognitoDefaults.region,
  userPoolId: cognitoDefaults.userPoolId,
  userPoolClientId: cognitoDefaults.userPoolClientId,
  username: cognitoDefaults.username,
  password: cognitoDefaults.password,
})

const discovering = ref(false)
const signingIn = ref(false)
const signedIn = ref(false)
const showPassword = ref(false)
const error = ref('')
const statusMessage = ref('')
const tokens = reactive({
  idToken: '',
  accessToken: '',
})
const decoded = reactive({
  idToken: null,
  accessToken: null,
})

const sessionState = computed(() => {
  if (signedIn.value) return `Signed in as ${form.username}`
  if (tokens.idToken || tokens.accessToken) return 'Tokens loaded'
  return 'Not signed in'
})

async function discoverCognito() {
  discovering.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const result = await discoverCognitoResources(form)
    form.userPoolId = result.userPoolId
    form.userPoolClientId = result.userPoolClientId
    statusMessage.value = `Detected ${result.poolName} / ${result.clientName}.`
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to detect Cognito resources.')
  } finally {
    discovering.value = false
  }
}

async function login() {
  signingIn.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    if (!form.userPoolId || !form.userPoolClientId) {
      await discoverCognito()
    }

    const result = await signInToCognito(form)

    if (!result.signedIn) {
      statusMessage.value = `Amplify next step: ${result.nextStep}`
      return
    }

    applyTokens(result.tokens)
    signedIn.value = true
    statusMessage.value = 'Amplify sign-in succeeded and JWTs were issued.'
  } catch (caught) {
    signedIn.value = false
    error.value = messageFromError(caught, 'Amplify sign-in failed.')
  } finally {
    signingIn.value = false
  }
}

function applyTokens(sessionTokens) {
  tokens.idToken = sessionTokens.idToken
  tokens.accessToken = sessionTokens.accessToken
  decoded.idToken = decodeJwt(tokens.idToken)
  decoded.accessToken = decodeJwt(tokens.accessToken)
}

async function logout() {
  error.value = ''
  statusMessage.value = ''

  try {
    await signOutFromCognito(form)
  } catch (caught) {
    error.value = messageFromError(caught, 'Amplify sign-out failed.')
  } finally {
    signedIn.value = false
    tokens.idToken = ''
    tokens.accessToken = ''
    decoded.idToken = null
    decoded.accessToken = null
  }
}

function decodeJwt(token) {
  if (!token) return null

  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decodedPayload = atob(normalized)
    const bytes = Uint8Array.from(decodedPayload, (char) => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return { raw: 'Unable to decode token payload.' }
  }
}

function formatJson(value) {
  if (!value) return '{}'
  return JSON.stringify(value, null, 2)
}

function tokenPreview(token) {
  if (!token) return 'No token'
  if (token.length <= 80) return token
  return `${token.slice(0, 42)}...${token.slice(-24)}`
}

function messageFromError(caught, fallback) {
  if (caught instanceof Error && caught.message) return caught.message
  return fallback
}

onMounted(discoverCognito)
</script>

<style scoped>
.auth-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 16px;
}

.auth-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.auth-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(280px, 420px) minmax(0, 1fr);
  padding: 16px;
}

.auth-form {
  display: grid;
  gap: 14px;
}

.auth-result {
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  min-width: 0;
  padding-left: 20px;
}

.result-toolbar {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.token-table th {
  color: rgb(var(--v-theme-on-surface-variant));
  font-weight: 500;
  width: 120px;
}

.token-table td {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}

.jwt-panels {
  margin-top: 14px;
}

pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  margin: 0;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
}

@media (max-width: 960px) {
  .auth-header,
  .result-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .auth-actions {
    justify-content: stretch;
  }

  .auth-actions :deep(.v-btn) {
    flex: 1 1 140px;
  }

  .auth-grid {
    grid-template-columns: 1fr;
  }

  .auth-result {
    border-left: 0;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    padding-left: 0;
    padding-top: 16px;
  }
}
</style>
