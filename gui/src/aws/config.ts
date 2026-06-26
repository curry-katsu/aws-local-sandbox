const STORAGE_KEY = 'aws-local-sandbox.browser-config'

export const defaultBrowserConfig = {
  endpoint:
    import.meta.env.VITE_AWS_BROWSER_ENDPOINT_URL || `${window.location.origin}/floci`,
  debugBaseUrl: import.meta.env.VITE_DEBUG_API_BROWSER_URL || '/debug',
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
}

export function loadBrowserConfig() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      endpoint: normalizeBaseUrl(stored.endpoint) || defaultBrowserConfig.endpoint,
      debugBaseUrl: normalizeBaseUrl(stored.debugBaseUrl) || defaultBrowserConfig.debugBaseUrl,
      region: stored.region?.trim() || defaultBrowserConfig.region,
    }
  } catch {
    return { ...defaultBrowserConfig }
  }
}

export function saveBrowserConfig(config) {
  const nextConfig = {
    endpoint: normalizeBaseUrl(config.endpoint) || defaultBrowserConfig.endpoint,
    debugBaseUrl: normalizeBaseUrl(config.debugBaseUrl) || defaultBrowserConfig.debugBaseUrl,
    region: config.region?.trim() || defaultBrowserConfig.region,
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig))
}

export function resetBrowserConfig() {
  window.localStorage.removeItem(STORAGE_KEY)
}

function normalizeBaseUrl(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed === '/' ? trimmed : trimmed.replace(/\/+$/, '')
}

const browserConfig = loadBrowserConfig()

export const endpoint = browserConfig.endpoint
export const debugBaseUrl = browserConfig.debugBaseUrl
export const region = browserConfig.region
export const credentials = {
  accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || 'test',
  secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || 'test',
}

export const clientConfig = {
  endpoint,
  region,
  credentials,
}

export const s3ClientConfig = {
  ...clientConfig,
  forcePathStyle: true,
}
