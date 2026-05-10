terraform {
  required_version = ">= 1.6.0"

  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }

    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                      = var.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  s3_use_path_style           = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    apigateway     = var.aws_endpoint_url
    cloudformation = var.aws_endpoint_url
    cloudwatch     = var.aws_endpoint_url
    cognitoidp     = var.aws_endpoint_url
    dynamodb       = var.aws_endpoint_url
    ec2            = var.aws_endpoint_url
    ecr            = var.aws_endpoint_url
    events         = var.aws_endpoint_url
    iam            = var.aws_endpoint_url
    kinesis        = var.aws_endpoint_url
    lambda         = var.aws_endpoint_url
    logs           = var.aws_endpoint_url
    rds            = var.aws_endpoint_url
    s3             = var.aws_endpoint_url
    sns            = var.aws_endpoint_url
    sqs            = var.aws_endpoint_url
    sfn            = var.aws_endpoint_url
    sts            = var.aws_endpoint_url
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region used by the local emulator."
  default     = "us-east-1"
}

variable "aws_endpoint_url" {
  type        = string
  description = "Floci/LocalStack-compatible endpoint URL."
  default     = "http://localhost:4566"
}
