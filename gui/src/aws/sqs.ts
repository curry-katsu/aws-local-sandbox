import {
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  ListQueuesCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SetQueueAttributesCommand,
  SQSClient,
} from '@aws-sdk/client-sqs'
import { clientConfig } from './config'

const sqs = new SQSClient(clientConfig)

export async function listQueues() {
  const result = await sqs.send(new ListQueuesCommand({}))
  return (result.QueueUrls || []).map((url) => ({ url, name: url.split('/').pop() }))
}

export async function getQueueAttributes(queueUrl) {
  const result = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['All'],
    }),
  )
  return result.Attributes || {}
}

export async function receiveQueueMessages(queueUrl, maxMessages) {
  const result = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 0,
      AttributeNames: ['All'],
      MessageAttributeNames: ['All'],
    }),
  )
  return result.Messages || []
}

export async function sendQueueMessage(queueUrl, body) {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: body || '{}',
    }),
  )
}

export async function deleteQueueMessage(queueUrl, receiptHandle) {
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    }),
  )
}

export async function setQueueAttributes(queueUrl, attributes) {
  await sqs.send(
    new SetQueueAttributesCommand({
      QueueUrl: queueUrl,
      Attributes: Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== '')),
    }),
  )
}

