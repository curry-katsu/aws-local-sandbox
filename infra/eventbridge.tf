data "archive_file" "eventbridge_daily_noon_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/eventbridge_daily_noon"
  output_path = "${path.module}/build/eventbridge_daily_noon.zip"
}

resource "aws_iam_role" "eventbridge_daily_noon_lambda" {
  name = "aws-local-sandbox-eventbridge-daily-noon-lambda-role"

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

resource "aws_lambda_function" "eventbridge_daily_noon" {
  function_name = "aws-local-sandbox-eventbridge-daily-noon"
  role          = aws_iam_role.eventbridge_daily_noon_lambda.arn
  runtime       = "python3.12"
  handler       = "index.handler"
  timeout       = 15

  filename         = data.archive_file.eventbridge_daily_noon_lambda.output_path
  source_code_hash = data.archive_file.eventbridge_daily_noon_lambda.output_base64sha256

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

resource "aws_cloudwatch_event_rule" "daily_noon_jst" {
  name                = "aws-local-sandbox-daily-noon-jst"
  description         = "Runs the local verification Lambda every day at 12:00 JST."
  schedule_expression = "cron(0 3 * * ? *)"

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

resource "aws_cloudwatch_event_target" "daily_noon_jst_lambda" {
  rule      = aws_cloudwatch_event_rule.daily_noon_jst.name
  target_id = "eventbridge-daily-noon-lambda"
  arn       = aws_lambda_function.eventbridge_daily_noon.arn

  input = jsonencode({
    source      = "aws-local-sandbox.eventbridge"
    description = "Scheduled EventBridge invocation for 12:00 JST."
    timezone    = "Asia/Tokyo"
  })
}

resource "aws_lambda_permission" "allow_eventbridge_daily_noon" {
  statement_id  = "AllowExecutionFromEventBridgeDailyNoonJst"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.eventbridge_daily_noon.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_noon_jst.arn
}
