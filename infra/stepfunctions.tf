data "archive_file" "stepfunctions_first_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/stepfunctions_first"
  output_path = "${path.module}/build/stepfunctions_first.zip"
}

data "archive_file" "stepfunctions_second_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/stepfunctions_second"
  output_path = "${path.module}/build/stepfunctions_second.zip"
}

resource "aws_iam_role" "stepfunctions_demo_lambda" {
  name = "aws-local-sandbox-stepfunctions-demo-lambda-role"

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

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

resource "aws_lambda_function" "stepfunctions_first" {
  function_name = "aws-local-sandbox-stepfunctions-first"
  role          = aws_iam_role.stepfunctions_demo_lambda.arn
  runtime       = "python3.12"
  handler       = "index.handler"
  timeout       = 15

  filename         = data.archive_file.stepfunctions_first_lambda.output_path
  source_code_hash = data.archive_file.stepfunctions_first_lambda.output_base64sha256

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

resource "aws_lambda_function" "stepfunctions_second" {
  function_name = "aws-local-sandbox-stepfunctions-second"
  role          = aws_iam_role.stepfunctions_demo_lambda.arn
  runtime       = "python3.12"
  handler       = "index.handler"
  timeout       = 15

  filename         = data.archive_file.stepfunctions_second_lambda.output_path
  source_code_hash = data.archive_file.stepfunctions_second_lambda.output_base64sha256

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

resource "aws_iam_role" "stepfunctions_demo" {
  name = "aws-local-sandbox-stepfunctions-demo-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "stepfunctions_demo_invoke_lambda" {
  name = "aws-local-sandbox-stepfunctions-demo-invoke-lambda"
  role = aws_iam_role.stepfunctions_demo.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.stepfunctions_first.arn,
          aws_lambda_function.stepfunctions_second.arn,
        ]
      }
    ]
  })
}

locals {
  stepfunctions_demo_state_machine_name = "aws-local-sandbox-stepfunctions-two-lambdas"
  stepfunctions_demo_state_machine_arn  = "arn:aws:states:${var.aws_region}:000000000000:stateMachine:${local.stepfunctions_demo_state_machine_name}"

  stepfunctions_demo_definition = jsonencode({
    Comment = "Local Step Functions demo that invokes two Lambdas on Floci."
    StartAt = "InvokeFirstLambda"
    States = {
      InvokeFirstLambda = {
        Type       = "Task"
        Resource   = aws_lambda_function.stepfunctions_first.arn
        ResultPath = "$.firstLambdaResult"
        Next       = "InvokeSecondLambda"
      }
      InvokeSecondLambda = {
        Type     = "Task"
        Resource = aws_lambda_function.stepfunctions_second.arn
        End      = true
      }
    }
  })
}

resource "terraform_data" "stepfunctions_demo_state_machine" {
  input = {
    aws_access_key_id     = "test"
    aws_default_region    = var.aws_region
    aws_endpoint_url      = var.aws_endpoint_url
    aws_secret_access_key = "test"
    definition            = local.stepfunctions_demo_definition
    role_arn              = aws_iam_role.stepfunctions_demo.arn
    state_machine_arn     = local.stepfunctions_demo_state_machine_arn
    state_machine_name    = local.stepfunctions_demo_state_machine_name
  }

  triggers_replace = [
    local.stepfunctions_demo_definition,
    aws_iam_role.stepfunctions_demo.arn,
    aws_iam_role_policy.stepfunctions_demo_invoke_lambda.id,
  ]

  depends_on = [
    aws_lambda_function.stepfunctions_first,
    aws_lambda_function.stepfunctions_second,
    aws_iam_role_policy.stepfunctions_demo_invoke_lambda,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      set -eu
      if aws stepfunctions describe-state-machine --endpoint-url "$AWS_ENDPOINT_URL" --state-machine-arn "$STATE_MACHINE_ARN" >/dev/null 2>&1; then
        aws stepfunctions delete-state-machine --endpoint-url "$AWS_ENDPOINT_URL" --state-machine-arn "$STATE_MACHINE_ARN" >/dev/null
      fi
      aws stepfunctions create-state-machine \
        --endpoint-url "$AWS_ENDPOINT_URL" \
        --name "$STATE_MACHINE_NAME" \
        --role-arn "$ROLE_ARN" \
        --definition "$STATE_MACHINE_DEFINITION" >/dev/null
    EOT

    environment = {
      AWS_ACCESS_KEY_ID        = self.input.aws_access_key_id
      AWS_DEFAULT_REGION       = self.input.aws_default_region
      AWS_ENDPOINT_URL         = self.input.aws_endpoint_url
      AWS_SECRET_ACCESS_KEY    = self.input.aws_secret_access_key
      ROLE_ARN                 = self.input.role_arn
      STATE_MACHINE_ARN        = self.input.state_machine_arn
      STATE_MACHINE_DEFINITION = self.input.definition
      STATE_MACHINE_NAME       = self.input.state_machine_name
    }
  }

  provisioner "local-exec" {
    when    = destroy
    command = <<-EOT
      set -eu
      aws stepfunctions delete-state-machine --endpoint-url "$AWS_ENDPOINT_URL" --state-machine-arn "$STATE_MACHINE_ARN" >/dev/null 2>&1 || true
    EOT

    environment = {
      AWS_ACCESS_KEY_ID     = self.input.aws_access_key_id
      AWS_DEFAULT_REGION    = self.input.aws_default_region
      AWS_ENDPOINT_URL      = self.input.aws_endpoint_url
      AWS_SECRET_ACCESS_KEY = self.input.aws_secret_access_key
      STATE_MACHINE_ARN     = self.input.state_machine_arn
    }
  }
}
