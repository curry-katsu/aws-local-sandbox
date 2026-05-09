import {
  CreateTopicCommand,
  DeleteTopicCommand,
  GetTopicAttributesCommand,
  ListSubscriptionsByTopicCommand,
  ListTopicsCommand,
  PublishCommand,
  SetTopicAttributesCommand,
  SNSClient,
} from '@aws-sdk/client-sns'
import { clientConfig } from './config'

const sns = new SNSClient(clientConfig)

export async function listTopics() {
  const result = await sns.send(new ListTopicsCommand({}))
  return result.Topics || []
}

export async function getTopicDetail(topicArn) {
  const [attributeResult, subscriptionResult] = await Promise.all([
    sns.send(new GetTopicAttributesCommand({ TopicArn: topicArn })),
    sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: topicArn })),
  ])
  return {
    attributes: attributeResult.Attributes || {},
    subscriptions: subscriptionResult.Subscriptions || [],
  }
}

export async function publishTopicMessage(topicArn, subject, message) {
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: subject || undefined,
      Message: message || '{}',
    }),
  )
}

export async function setTopicDisplayName(topicArn, displayName) {
  await sns.send(
    new SetTopicAttributesCommand({
      TopicArn: topicArn,
      AttributeName: 'DisplayName',
      AttributeValue: displayName,
    }),
  )
}

export async function createTopic(name) {
  const result = await sns.send(new CreateTopicCommand({ Name: name }))
  return result.TopicArn || ''
}

export async function deleteTopic(topicArn) {
  await sns.send(new DeleteTopicCommand({ TopicArn: topicArn }))
}

