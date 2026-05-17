variable "enable_layer_demo_lambda_layer_publish" {
  type        = bool
  description = "Publish Lambda layer versions and create demo Lambda functions that attach them. Keep false for Floci because PublishLayerVersion returns HTTP 405."
  default     = false
}

data "archive_file" "layer_demo_utils" {
  type        = "zip"
  output_path = "${path.module}/build/layer_demo_utils.zip"

  source {
    content  = file("${path.module}/../verification/layer_demo/libs/utils/src/layer_demo_utils/__init__.py")
    filename = "python/layer_demo_utils/__init__.py"
  }

  source {
    content  = file("${path.module}/../verification/layer_demo/libs/utils/src/layer_demo_utils/metadata.py")
    filename = "python/layer_demo_utils/metadata.py"
  }
}

data "archive_file" "layer_demo_api_utils" {
  type        = "zip"
  output_path = "${path.module}/build/layer_demo_api_utils.zip"

  source {
    content  = file("${path.module}/../verification/layer_demo/libs/api-utils/src/api_utils/__init__.py")
    filename = "python/api_utils/__init__.py"
  }

  source {
    content  = file("${path.module}/../verification/layer_demo/libs/api-utils/src/api_utils/responses.py")
    filename = "python/api_utils/responses.py"
  }
}

data "archive_file" "layer_demo_batch_utils" {
  type        = "zip"
  output_path = "${path.module}/build/layer_demo_batch_utils.zip"

  source {
    content  = file("${path.module}/../verification/layer_demo/libs/batch-utils/src/batch_utils/__init__.py")
    filename = "python/batch_utils/__init__.py"
  }

  source {
    content  = file("${path.module}/../verification/layer_demo/libs/batch-utils/src/batch_utils/records.py")
    filename = "python/batch_utils/records.py"
  }
}

data "archive_file" "layer_demo_sample_api_lambda" {
  type        = "zip"
  output_path = "${path.module}/build/layer_demo_sample_api_lambda.zip"

  source {
    content  = file("${path.module}/../verification/layer_demo/applications/apis/sample-api/src/sample_api/__init__.py")
    filename = "sample_api/__init__.py"
  }

  source {
    content  = file("${path.module}/../verification/layer_demo/applications/apis/sample-api/src/sample_api/handler.py")
    filename = "sample_api/handler.py"
  }

  source {
    content  = file("${path.module}/../verification/layer_demo/libs/sample-function-core/src/sample_function_core/__init__.py")
    filename = "sample_function_core/__init__.py"
  }

  source {
    content  = file("${path.module}/../verification/layer_demo/libs/sample-function-core/src/sample_function_core/use_case.py")
    filename = "sample_function_core/use_case.py"
  }
}

data "archive_file" "layer_demo_sample_sqs_handler_lambda" {
  type        = "zip"
  output_path = "${path.module}/build/layer_demo_sample_sqs_handler_lambda.zip"

  source {
    content  = file("${path.module}/../verification/layer_demo/applications/batches/sample-sqs-handler/src/sample_sqs_handler/__init__.py")
    filename = "sample_sqs_handler/__init__.py"
  }

  source {
    content  = file("${path.module}/../verification/layer_demo/applications/batches/sample-sqs-handler/src/sample_sqs_handler/handler.py")
    filename = "sample_sqs_handler/handler.py"
  }
}

data "archive_file" "layer_demo_sample_eventbridge_handler_lambda" {
  type        = "zip"
  output_path = "${path.module}/build/layer_demo_sample_eventbridge_handler_lambda.zip"

  source {
    content  = file("${path.module}/../verification/layer_demo/applications/batches/sample-eventbridge-handler/src/sample_eventbridge_handler/__init__.py")
    filename = "sample_eventbridge_handler/__init__.py"
  }

  source {
    content  = file("${path.module}/../verification/layer_demo/applications/batches/sample-eventbridge-handler/src/sample_eventbridge_handler/handler.py")
    filename = "sample_eventbridge_handler/handler.py"
  }
}

resource "aws_lambda_layer_version" "layer_demo_utils" {
  count = var.enable_layer_demo_lambda_layer_publish ? 1 : 0

  layer_name          = "aws-local-sandbox-layer-demo-utils"
  description         = "System-wide shared utilities for the Floci Lambda layer demo."
  compatible_runtimes = ["python3.13"]

  filename         = data.archive_file.layer_demo_utils.output_path
  source_code_hash = data.archive_file.layer_demo_utils.output_base64sha256
}

resource "aws_lambda_layer_version" "layer_demo_api_utils" {
  count = var.enable_layer_demo_lambda_layer_publish ? 1 : 0

  layer_name          = "aws-local-sandbox-layer-demo-api-utils"
  description         = "API shared utilities for the Floci Lambda layer demo. Requires the utils layer."
  compatible_runtimes = ["python3.13"]

  filename         = data.archive_file.layer_demo_api_utils.output_path
  source_code_hash = data.archive_file.layer_demo_api_utils.output_base64sha256
}

resource "aws_lambda_layer_version" "layer_demo_batch_utils" {
  count = var.enable_layer_demo_lambda_layer_publish ? 1 : 0

  layer_name          = "aws-local-sandbox-layer-demo-batch-utils"
  description         = "Batch shared utilities for the Floci Lambda layer demo. Requires the utils layer."
  compatible_runtimes = ["python3.13"]

  filename         = data.archive_file.layer_demo_batch_utils.output_path
  source_code_hash = data.archive_file.layer_demo_batch_utils.output_base64sha256
}

resource "aws_iam_role" "layer_demo_lambda" {
  count = var.enable_layer_demo_lambda_layer_publish ? 1 : 0

  name = "aws-local-sandbox-layer-demo-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_lambda_function" "layer_demo_sample_api" {
  count = var.enable_layer_demo_lambda_layer_publish ? 1 : 0

  function_name = "aws-local-sandbox-layer-demo-sample-api"
  role          = aws_iam_role.layer_demo_lambda[0].arn
  runtime       = "python3.13"
  handler       = "sample_api.handler.lambda_handler"
  timeout       = 15

  filename         = data.archive_file.layer_demo_sample_api_lambda.output_path
  source_code_hash = data.archive_file.layer_demo_sample_api_lambda.output_base64sha256

  layers = [
    aws_lambda_layer_version.layer_demo_utils[0].arn,
    aws_lambda_layer_version.layer_demo_api_utils[0].arn,
  ]
}

resource "aws_lambda_function" "layer_demo_sample_sqs_handler" {
  count = var.enable_layer_demo_lambda_layer_publish ? 1 : 0

  function_name = "aws-local-sandbox-layer-demo-sample-sqs-handler"
  role          = aws_iam_role.layer_demo_lambda[0].arn
  runtime       = "python3.13"
  handler       = "sample_sqs_handler.handler.lambda_handler"
  timeout       = 15

  filename         = data.archive_file.layer_demo_sample_sqs_handler_lambda.output_path
  source_code_hash = data.archive_file.layer_demo_sample_sqs_handler_lambda.output_base64sha256

  layers = [
    aws_lambda_layer_version.layer_demo_utils[0].arn,
    aws_lambda_layer_version.layer_demo_batch_utils[0].arn,
  ]
}

resource "aws_lambda_function" "layer_demo_sample_eventbridge_handler" {
  count = var.enable_layer_demo_lambda_layer_publish ? 1 : 0

  function_name = "aws-local-sandbox-layer-demo-sample-eventbridge-handler"
  role          = aws_iam_role.layer_demo_lambda[0].arn
  runtime       = "python3.13"
  handler       = "sample_eventbridge_handler.handler.lambda_handler"
  timeout       = 15

  filename         = data.archive_file.layer_demo_sample_eventbridge_handler_lambda.output_path
  source_code_hash = data.archive_file.layer_demo_sample_eventbridge_handler_lambda.output_base64sha256

  layers = [
    aws_lambda_layer_version.layer_demo_utils[0].arn,
  ]
}
