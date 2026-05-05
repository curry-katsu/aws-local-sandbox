resource "aws_s3_bucket" "sandbox" {
  bucket        = "aws-local-sandbox-bucket"
  force_destroy = true

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

resource "aws_dynamodb_table" "sandbox" {
  name         = "aws-local-sandbox-table"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

resource "aws_sqs_queue" "sandbox" {
  name                       = "aws-local-sandbox-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

output "s3_bucket_name" {
  value = aws_s3_bucket.sandbox.bucket
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.sandbox.name
}

output "sqs_queue_url" {
  value = aws_sqs_queue.sandbox.url
}
