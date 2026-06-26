const http = require('node:http')

const port = Number(process.env.PORT || 5180)
const dockerSocketPath = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
const flociContainerName = process.env.FLOCI_CONTAINER_NAME || 'aws-local-sandbox-floci'
const defaultTail = Number(process.env.DEFAULT_LOG_TAIL || 200)
const maxTail = Number(process.env.MAX_LOG_TAIL || 1000)
const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

const server = http.createServer(async (request, response) => {
  const corsAllowed = setCorsHeaders(request, response)

  if (request.method === 'OPTIONS') {
    if (
      corsAllowed &&
      request.headers['access-control-request-private-network'] === 'true'
    ) {
      response.setHeader('Access-Control-Allow-Private-Network', 'true')
    }
    response.writeHead(204)
    response.end()
    return
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true })
      return
    }

    const functionLogMatch = url.pathname.match(/^\/debug\/lambda\/functions\/([^/]+)\/logs$/)
    if (request.method === 'GET' && functionLogMatch) {
      const functionName = decodeURIComponent(functionLogMatch[1])
      const tail = clampNumber(Number(url.searchParams.get('tail') || defaultTail), 1, maxTail)
      const requestId = url.searchParams.get('requestId') || ''
      const result = await readLambdaLogs({ functionName, requestId, tail })
      sendJson(response, 200, result)
      return
    }

    sendJson(response, 404, { error: 'Not found' })
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unexpected debug API error.',
    })
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`debug-api listening on ${port}`)
})

async function readLambdaLogs({ functionName, requestId, tail }) {
  const dockerTail = Math.min(maxTail * 10, Math.max(tail * 10, 500))
  const rawLogs = await readDockerContainerLogs(flociContainerName, dockerTail)
  const events = parseFlociLambdaLogs(rawLogs)
    .filter((event) => event.functionName === functionName)
    .filter((event) => !requestId || event.requestId === requestId || event.message.includes(requestId))
    .slice(-tail)

  return {
    provider: 'docker',
    containerName: flociContainerName,
    functionName,
    events,
  }
}

function readDockerContainerLogs(containerName, tail) {
  const path = `/containers/${encodeURIComponent(containerName)}/logs?stdout=1&stderr=1&timestamps=1&tail=${tail}`

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        method: 'GET',
        socketPath: dockerSocketPath,
        path,
      },
      (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const body = Buffer.concat(chunks)
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`Docker logs request failed with HTTP ${response.statusCode}: ${body.toString('utf8')}`))
            return
          }
          resolve(decodeDockerLogBuffer(body))
        })
      },
    )

    request.on('error', reject)
    request.end()
  })
}

function decodeDockerLogBuffer(buffer) {
  const chunks = []
  let offset = 0

  while (offset + 8 <= buffer.length) {
    const streamType = buffer[offset]
    const size = buffer.readUInt32BE(offset + 4)
    const nextOffset = offset + 8 + size

    if (![1, 2].includes(streamType) || size < 0 || nextOffset > buffer.length) {
      return buffer.toString('utf8')
    }

    chunks.push(buffer.subarray(offset + 8, nextOffset))
    offset = nextOffset
  }

  if (offset !== buffer.length) {
    return buffer.toString('utf8')
  }

  return Buffer.concat(chunks).toString('utf8')
}

function parseFlociLambdaLogs(rawLogs) {
  return rawLogs
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseFlociLambdaLogLine)
    .filter(Boolean)
}

function parseFlociLambdaLogLine(line) {
  const dockerTimestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\S+)\s+(.*)$/)
  const timestamp = dockerTimestampMatch ? dockerTimestampMatch[1] : null
  const messageLine = dockerTimestampMatch ? dockerTimestampMatch[2] : line
  const lambdaMatch = messageLine.match(/\[lambda:([^\]]+)]\s*(.*)$/)

  if (!lambdaMatch) return null

  const functionName = lambdaMatch[1]
  const message = lambdaMatch[2] || ''
  const parsedMessage = parseJson(message)
  const requestId = parsedMessage && typeof parsedMessage === 'object' ? parsedMessage.requestId : undefined

  return {
    timestamp: timestamp || parseFlociTimestamp(messageLine),
    source: 'docker',
    functionName,
    requestId,
    message,
    parsedMessage,
    raw: line,
  }
}

function parseFlociTimestamp(line) {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})/)
  return match ? match[1] : null
}

function parseJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(payload))
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin
  const isAllowed = Boolean(origin && (allowedOrigins.has('*') || allowedOrigins.has(origin)))

  response.setHeader('Vary', 'Origin')
  if (!isAllowed) return false

  response.setHeader('Access-Control-Allow-Origin', allowedOrigins.has('*') ? '*' : origin)
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  return true
}
