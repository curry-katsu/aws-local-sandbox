resource "aws_sns_topic" "sandbox_fanout" {
  name = "aws-local-sandbox-fanout-topic"

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

resource "aws_sqs_queue" "sns_fanout_primary" {
  name                       = "aws-local-sandbox-sns-fanout-primary-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

resource "aws_sqs_queue" "sns_fanout_secondary" {
  name                       = "aws-local-sandbox-sns-fanout-secondary-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

data "aws_iam_policy_document" "sns_fanout_primary_sqs" {
  statement {
    sid    = "AllowSnsFanoutTopicToSendMessages"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }

    actions = ["sqs:SendMessage"]

    resources = [aws_sqs_queue.sns_fanout_primary.arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.sandbox_fanout.arn]
    }
  }
}

data "aws_iam_policy_document" "sns_fanout_secondary_sqs" {
  statement {
    sid    = "AllowSnsFanoutTopicToSendMessages"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.sns_fanout_secondary.arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.sandbox_fanout.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "sns_fanout_primary" {
  queue_url = aws_sqs_queue.sns_fanout_primary.url
  policy    = data.aws_iam_policy_document.sns_fanout_primary_sqs.json
}

resource "aws_sqs_queue_policy" "sns_fanout_secondary" {
  queue_url = aws_sqs_queue.sns_fanout_secondary.url
  policy    = data.aws_iam_policy_document.sns_fanout_secondary_sqs.json
}

resource "aws_sns_topic_subscription" "sandbox_fanout_primary" {
  topic_arn            = aws_sns_topic.sandbox_fanout.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.sns_fanout_primary.arn
  raw_message_delivery = true

  depends_on = [aws_sqs_queue_policy.sns_fanout_primary]
}

resource "aws_sns_topic_subscription" "sandbox_fanout_secondary" {
  topic_arn            = aws_sns_topic.sandbox_fanout.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.sns_fanout_secondary.arn
  raw_message_delivery = true

  depends_on = [aws_sqs_queue_policy.sns_fanout_secondary]
}
