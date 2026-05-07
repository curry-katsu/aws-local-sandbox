resource "aws_sqs_queue" "sandbox" {
  name                       = "aws-local-sandbox-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}
