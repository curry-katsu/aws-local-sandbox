import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { s3ClientConfig } from './config'

const s3 = new S3Client(s3ClientConfig)

export async function listBuckets() {
  const result = await s3.send(new ListBucketsCommand({}))
  return result.Buckets || []
}

export async function listObjects(bucket, prefix) {
  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      MaxKeys: 100,
    }),
  )
  return result.Contents || []
}

export async function getObjectText(bucket, key) {
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return result.Body ? result.Body.transformToString() : ''
}

export async function putTextObject(bucket, key, body, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'text/plain',
    }),
  )
}

export async function deleteObject(bucket, key) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

