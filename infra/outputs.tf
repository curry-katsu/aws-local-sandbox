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

output "eventbridge_daily_noon_rule_name" {
  value = aws_cloudwatch_event_rule.daily_noon_jst.name
}

output "eventbridge_daily_noon_schedule_expression" {
  value = aws_cloudwatch_event_rule.daily_noon_jst.schedule_expression
}

output "eventbridge_daily_noon_lambda_name" {
  value = aws_lambda_function.eventbridge_daily_noon.function_name
}

output "stepfunctions_demo_state_machine_arn" {
  value      = local.stepfunctions_demo_state_machine_arn
  depends_on = [terraform_data.stepfunctions_demo_state_machine]
}

output "stepfunctions_first_lambda_name" {
  value = aws_lambda_function.stepfunctions_first.function_name
}

output "stepfunctions_second_lambda_name" {
  value = aws_lambda_function.stepfunctions_second.function_name
}
