output "s3_bucket_name" {
  value = aws_s3_bucket.sandbox.bucket
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.sandbox.name
}

output "dynamodb_index_ttl_table_name" {
  value = aws_dynamodb_table.index_ttl_verification.name
}

output "sqs_queue_url" {
  value = aws_sqs_queue.sandbox.url
}

output "sns_fanout_topic_arn" {
  value = aws_sns_topic.sandbox_fanout.arn
}

output "sns_fanout_primary_queue_url" {
  value = aws_sqs_queue.sns_fanout_primary.url
}

output "sns_fanout_secondary_queue_url" {
  value = aws_sqs_queue.sns_fanout_secondary.url
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

output "aurora_postgres_demo_cluster_identifier" {
  value = aws_rds_cluster.aurora_postgres_demo.cluster_identifier
}

output "aurora_postgres_demo_engine" {
  value = aws_rds_cluster.aurora_postgres_demo.engine
}

output "aurora_postgres_demo_engine_version" {
  value = aws_rds_cluster.aurora_postgres_demo.engine_version_actual
}

output "aurora_postgres_demo_writer_endpoint" {
  value = aws_rds_cluster.aurora_postgres_demo.endpoint
}

output "aurora_postgres_demo_reader_endpoint" {
  value = aws_rds_cluster.aurora_postgres_demo.reader_endpoint
}

output "aurora_postgres_demo_port" {
  value = aws_rds_cluster.aurora_postgres_demo.port
}
