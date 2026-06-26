import { debugBaseUrl } from './config'

export async function getLambdaLogs(functionName, options = {}) {
  const tail = options.tail || 200
  const requestId = options.requestId || ''
  const params = new URLSearchParams({ tail: String(tail) })

  if (requestId) {
    params.set('requestId', requestId)
  }

  const response = await fetch(
    `${debugBaseUrl}/lambda/functions/${encodeURIComponent(functionName)}/logs?${params}`,
  )

  if (!response.ok) {
    throw new Error(`Failed to load Lambda logs: HTTP ${response.status}`)
  }

  return response.json()
}
