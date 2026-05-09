export const endpoint = import.meta.env.VITE_AWS_BROWSER_ENDPOINT_URL || `${window.location.origin}/floci`
export const region = import.meta.env.VITE_AWS_REGION || 'us-east-1'
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

