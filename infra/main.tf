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

resource "aws_cognito_user_pool" "sandbox" {
  name = "aws-local-sandbox-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 2048
    }
  }

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

resource "aws_cognito_user_pool_client" "sandbox" {
  name         = "aws-local-sandbox-user-pool-client"
  user_pool_id = aws_cognito_user_pool.sandbox.id

  generate_secret = false
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

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.sandbox.id
}

output "cognito_user_pool_arn" {
  value = aws_cognito_user_pool.sandbox.arn
}

output "cognito_user_pool_client_id" {
  value = aws_cognito_user_pool_client.sandbox.id
}
