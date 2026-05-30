SHELL := /bin/sh

AWS_ENDPOINT_URL ?= http://localhost:4566
AWS_DEFAULT_REGION ?= us-east-1
AWS_ACCESS_KEY_ID ?= test
AWS_SECRET_ACCESS_KEY ?= test
AWS_DEFAULT_OUTPUT = json
AWS_PAGER =
AWS_LOCAL_ENV = AWS_ENDPOINT_URL=$(AWS_ENDPOINT_URL) AWS_DEFAULT_REGION=$(AWS_DEFAULT_REGION) AWS_ACCESS_KEY_ID=$(AWS_ACCESS_KEY_ID) AWS_SECRET_ACCESS_KEY=$(AWS_SECRET_ACCESS_KEY) AWS_PAGER="$(AWS_PAGER)"
SQS_QUEUE_NAME ?= aws-local-sandbox-queue
SQS_QUEUE_URL ?= $(AWS_ENDPOINT_URL)/000000000000/$(SQS_QUEUE_NAME)
DYNAMODB_TABLE_NAME ?= aws-local-sandbox-table
DYNAMODB_INDEX_TTL_TABLE_NAME ?= aws-local-sandbox-index-ttl-table
S3_BUCKET_NAME ?= aws-local-sandbox-bucket
S3_LOG_PREFIX ?= verification-logs
VERIFY_MESSAGE_BODY ?= {"source":"make","message":"hello from aws-local-sandbox"}
SNS_FANOUT_MESSAGE ?= {"source":"make","message":"hello from SNS fanout","sent_at":"$(shell date -u +%Y-%m-%dT%H:%M:%SZ)"}
COGNITO_USERNAME ?= sandbox-user@example.com
COGNITO_PASSWORD ?= Sandbox123
EVENTBRIDGE_INVOKE_OUTPUT ?= /tmp/aws-local-sandbox-eventbridge-daily-noon-response.json
STEPFUNCTIONS_INPUT ?= {"source":"make","message":"hello from Step Functions"}
RDS_CLUSTER_IDENTIFIER ?= aws-local-sandbox-aurora-postgres-demo
RDS_DB_NAME ?= sandbox
RDS_DB_USER ?= sandbox
RDS_DB_PASSWORD ?= Sandbox123
RDS_DB_HOST ?= localhost
RDS_DB_PORT ?= 7001

.PHONY: help up down logs ps infra-init infra-plan infra-apply infra-destroy gui-install gui-dev smoke verify-install verify-send-message verify-run verify-dynamodb-install verify-dynamodb-run verify-dynamodb-index-ttl-run verify-dynamodb-format verify-dynamodb-lint verify-dynamodb-scan verify-s3-ls verify-s3-cat verify-format verify-lint verify-sns-topics verify-sns-subscriptions verify-sns-publish verify-sns-receive-primary verify-sns-receive-secondary verify-sns-fanout verify-cognito-install verify-cognito-create-user verify-cognito-login-jwt verify-cognito-format verify-cognito-lint verify-rds-install verify-rds-run verify-rds-format verify-rds-lint verify-eventbridge-rule verify-eventbridge-targets verify-eventbridge-invoke-lambda verify-stepfunctions-state-machine verify-stepfunctions-start-execution verify-stepfunctions-execution-history fmt clean

help:
	@printf '%s\n' \
		'aws-local-sandbox commands:' \
		'  make up            Start Floci and GUI containers' \
		'  make down          Stop containers' \
		'  make logs          Follow Docker Compose logs' \
		'  make infra-init    Initialize Terraform in ./infra' \
		'  make infra-plan    Plan Terraform resources against Floci' \
		'  make infra-apply   Apply Terraform resources against Floci' \
		'  make infra-destroy Destroy Terraform resources from Floci' \
		'  make gui-install   Install GUI dependencies' \
		'  make gui-dev       Run the GUI locally with Vite' \
		'  make smoke         List S3, DynamoDB, and SQS through AWS CLI' \
		'  make verify-install Install verification tool dependencies' \
		'  make verify-send-message Send a sample message to the verification SQS queue' \
		'  make verify-run    Run SQS -> DynamoDB -> S3 log verification tool' \
		'  make verify-dynamodb-install Install DynamoDB data access verification dependencies' \
		'  make verify-dynamodb-run Run DynamoDB data access verification tool' \
		'  make verify-dynamodb-index-ttl-run Verify DynamoDB LSI, GSI, sparse GSI, and TTL behavior' \
		'  make verify-dynamodb-format Format DynamoDB data access verification code' \
		'  make verify-dynamodb-lint Lint DynamoDB data access verification code' \
		'  make verify-dynamodb-scan Scan verification DynamoDB table items' \
		'  make verify-s3-ls   List verification log files in S3' \
		'  make verify-s3-cat FILE=<key> Print an S3 object body' \
		'  make verify-format Format verification Python code with black and isort' \
		'  make verify-lint   Lint verification Python code with black, isort, and flake8' \
		'  make verify-sns-topics List SNS topics' \
		'  make verify-sns-subscriptions List SNS subscriptions' \
		'  make verify-sns-fanout Publish one SNS message and read it from both subscribed SQS queues' \
		'  make verify-cognito-install Install Cognito verification tool dependencies' \
		'  make verify-cognito-create-user Create a sample Cognito user' \
		'  make verify-cognito-login-jwt Create/login a Cognito user and print JWTs' \
		'  make verify-cognito-format Format Cognito verification Python code' \
		'  make verify-cognito-lint Lint Cognito verification Python code' \
		'  make verify-rds-install Install RDS PostgreSQL verification dependencies' \
		'  make verify-rds-run Apply sample DDL and read/write demo PostgreSQL data' \
		'  make verify-rds-format Format RDS PostgreSQL verification Python code' \
		'  make verify-rds-lint Lint RDS PostgreSQL verification Python code' \
		'  make verify-eventbridge-rule Describe the daily noon JST EventBridge rule' \
		'  make verify-eventbridge-targets List targets for the daily noon JST EventBridge rule' \
		'  make verify-eventbridge-invoke-lambda Invoke the scheduled Lambda manually' \
		'  make verify-stepfunctions-state-machine Describe the demo Step Functions state machine' \
		'  make verify-stepfunctions-start-execution Start and describe a demo Step Functions execution' \
		'  make verify-stepfunctions-execution-history EXECUTION_ARN=<arn> Print execution history' \
		'  make fmt           Format Terraform files' \
		'  make clean         Stop containers and delete local persisted Floci data'

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

infra-init:
	cd infra && terraform init

infra-plan:
	cd infra && $(AWS_LOCAL_ENV) terraform plan

infra-apply:
	cd infra && $(AWS_LOCAL_ENV) terraform apply -auto-approve

infra-destroy:
	cd infra && $(AWS_LOCAL_ENV) terraform destroy -auto-approve

gui-install:
	cd gui && npm install

gui-dev:
	cd gui && FLOCI_PROXY_TARGET=$(AWS_ENDPOINT_URL) VITE_AWS_ENDPOINT_URL=$(AWS_ENDPOINT_URL) VITE_AWS_REGION=$(AWS_DEFAULT_REGION) VITE_AWS_ACCESS_KEY_ID=$(AWS_ACCESS_KEY_ID) VITE_AWS_SECRET_ACCESS_KEY=$(AWS_SECRET_ACCESS_KEY) npm run dev

smoke:
	$(AWS_LOCAL_ENV) aws s3 ls --endpoint-url $(AWS_ENDPOINT_URL)
	$(AWS_LOCAL_ENV) aws dynamodb list-tables --endpoint-url $(AWS_ENDPOINT_URL)
	$(AWS_LOCAL_ENV) aws sqs list-queues --endpoint-url $(AWS_ENDPOINT_URL)
	$(AWS_LOCAL_ENV) aws sns list-topics --endpoint-url $(AWS_ENDPOINT_URL)

verify-install:
	cd verification/sqs_to_dynamodb_s3_log && poetry install

verify-send-message:
	$(AWS_LOCAL_ENV) aws sqs send-message --endpoint-url $(AWS_ENDPOINT_URL) --queue-url $(SQS_QUEUE_URL) --message-body '$(VERIFY_MESSAGE_BODY)'

verify-run:
	cd verification/sqs_to_dynamodb_s3_log && $(AWS_LOCAL_ENV) poetry run sqs-ddb-s3-verify

verify-dynamodb-install:
	cd verification/dynamodb_data_access && poetry install

verify-dynamodb-run:
	cd verification/dynamodb_data_access && $(AWS_LOCAL_ENV) poetry run dynamodb-data-access-verify

verify-dynamodb-index-ttl-run:
	cd verification/dynamodb_data_access && $(AWS_LOCAL_ENV) DYNAMODB_INDEX_TTL_TABLE_NAME="$(DYNAMODB_INDEX_TTL_TABLE_NAME)" poetry run dynamodb-index-ttl-verify

verify-dynamodb-format:
	cd verification/dynamodb_data_access && poetry run isort .
	cd verification/dynamodb_data_access && poetry run black .

verify-dynamodb-lint:
	cd verification/dynamodb_data_access && poetry run isort --check-only .
	cd verification/dynamodb_data_access && poetry run black --check .
	cd verification/dynamodb_data_access && poetry run flake8 .

verify-dynamodb-scan:
	$(AWS_LOCAL_ENV) aws dynamodb scan --endpoint-url $(AWS_ENDPOINT_URL) --table-name $(DYNAMODB_TABLE_NAME)

verify-s3-ls:
	$(AWS_LOCAL_ENV) aws s3 ls s3://$(S3_BUCKET_NAME)/$(S3_LOG_PREFIX)/ --recursive --endpoint-url $(AWS_ENDPOINT_URL)

verify-s3-cat:
	@test -n "$(FILE)" || (printf '%s\n' 'Usage: make verify-s3-cat FILE=verification-logs/YYYY/MM/DD/<run-id>.json' && exit 2)
	$(AWS_LOCAL_ENV) aws s3 cp s3://$(S3_BUCKET_NAME)/$(FILE) - --endpoint-url $(AWS_ENDPOINT_URL)

verify-format:
	cd verification/sqs_to_dynamodb_s3_log && poetry run isort .
	cd verification/sqs_to_dynamodb_s3_log && poetry run black .

verify-lint:
	cd verification/sqs_to_dynamodb_s3_log && poetry run isort --check-only .
	cd verification/sqs_to_dynamodb_s3_log && poetry run black --check .
	cd verification/sqs_to_dynamodb_s3_log && poetry run flake8 .

verify-sns-topics:
	$(AWS_LOCAL_ENV) aws sns list-topics --endpoint-url $(AWS_ENDPOINT_URL)

verify-sns-subscriptions:
	$(AWS_LOCAL_ENV) aws sns list-subscriptions --endpoint-url $(AWS_ENDPOINT_URL)

verify-sns-publish:
	@set -eu; \
	TOPIC_ARN="$${SNS_FANOUT_TOPIC_ARN:-$$(cd infra && terraform output -raw sns_fanout_topic_arn)}"; \
	$(AWS_LOCAL_ENV) aws sns publish \
		--endpoint-url $(AWS_ENDPOINT_URL) \
		--topic-arn "$$TOPIC_ARN" \
		--message '$(SNS_FANOUT_MESSAGE)'

verify-sns-receive-primary:
	@set -eu; \
	QUEUE_URL="$${SNS_FANOUT_PRIMARY_QUEUE_URL:-$$(cd infra && terraform output -raw sns_fanout_primary_queue_url)}"; \
	$(AWS_LOCAL_ENV) aws sqs receive-message \
		--endpoint-url $(AWS_ENDPOINT_URL) \
		--queue-url "$$QUEUE_URL" \
		--max-number-of-messages 10 \
		--wait-time-seconds 2

verify-sns-receive-secondary:
	@set -eu; \
	QUEUE_URL="$${SNS_FANOUT_SECONDARY_QUEUE_URL:-$$(cd infra && terraform output -raw sns_fanout_secondary_queue_url)}"; \
	$(AWS_LOCAL_ENV) aws sqs receive-message \
		--endpoint-url $(AWS_ENDPOINT_URL) \
		--queue-url "$$QUEUE_URL" \
		--max-number-of-messages 10 \
		--wait-time-seconds 2

verify-sns-fanout:
	$(MAKE) verify-sns-publish
	$(MAKE) verify-sns-receive-primary
	$(MAKE) verify-sns-receive-secondary

verify-cognito-install:
	cd verification/cognito_user_create && poetry install

verify-cognito-create-user:
	cd verification/cognito_user_create && $(AWS_LOCAL_ENV) poetry run cognito-user-create-verify

verify-cognito-login-jwt:
	@set -eu; \
	USER_POOL_ID="$${COGNITO_USER_POOL_ID:-$$(cd infra && terraform output -raw cognito_user_pool_id)}"; \
	CLIENT_ID="$${COGNITO_USER_POOL_CLIENT_ID:-$$(cd infra && terraform output -raw cognito_user_pool_client_id)}"; \
	cd verification/cognito_user_create && \
	$(AWS_LOCAL_ENV) \
	COGNITO_USER_POOL_ID="$$USER_POOL_ID" \
	COGNITO_USERNAME="$(COGNITO_USERNAME)" \
	COGNITO_USER_EMAIL="$(COGNITO_USERNAME)" \
	COGNITO_TEMPORARY_PASSWORD="$(COGNITO_PASSWORD)" \
	COGNITO_PERMANENT_PASSWORD="$(COGNITO_PASSWORD)" \
	COGNITO_SET_PERMANENT_PASSWORD=true \
	poetry run cognito-user-create-verify >/dev/null; \
	$(AWS_LOCAL_ENV) aws cognito-idp admin-initiate-auth \
		--endpoint-url $(AWS_ENDPOINT_URL) \
		--user-pool-id "$$USER_POOL_ID" \
		--client-id "$$CLIENT_ID" \
		--auth-flow ADMIN_USER_PASSWORD_AUTH \
		--auth-parameters USERNAME="$(COGNITO_USERNAME)",PASSWORD="$(COGNITO_PASSWORD)" \
		--query 'AuthenticationResult'

verify-cognito-format:
	cd verification/cognito_user_create && poetry run isort .
	cd verification/cognito_user_create && poetry run black .

verify-cognito-lint:
	cd verification/cognito_user_create && poetry run isort --check-only .
	cd verification/cognito_user_create && poetry run black --check .
	cd verification/cognito_user_create && poetry run flake8 .

verify-rds-install:
	cd verification/rds_postgres_data_access && poetry install

verify-rds-run:
	cd verification/rds_postgres_data_access && \
	$(AWS_LOCAL_ENV) \
	RDS_CLUSTER_IDENTIFIER="$(RDS_CLUSTER_IDENTIFIER)" \
	RDS_DB_NAME="$(RDS_DB_NAME)" \
	RDS_DB_USER="$(RDS_DB_USER)" \
	RDS_DB_PASSWORD="$(RDS_DB_PASSWORD)" \
	RDS_DB_HOST="$(RDS_DB_HOST)" \
	RDS_DB_PORT="$(RDS_DB_PORT)" \
	poetry run rds-postgres-verify

verify-rds-format:
	cd verification/rds_postgres_data_access && poetry run isort .
	cd verification/rds_postgres_data_access && poetry run black .

verify-rds-lint:
	cd verification/rds_postgres_data_access && poetry run isort --check-only .
	cd verification/rds_postgres_data_access && poetry run black --check .
	cd verification/rds_postgres_data_access && poetry run flake8 .

verify-eventbridge-rule:
	@set -eu; \
	RULE_NAME="$${EVENTBRIDGE_DAILY_NOON_RULE_NAME:-$$(cd infra && terraform output -raw eventbridge_daily_noon_rule_name)}"; \
	$(AWS_LOCAL_ENV) aws events describe-rule \
		--endpoint-url $(AWS_ENDPOINT_URL) \
		--name "$$RULE_NAME"

verify-eventbridge-targets:
	@set -eu; \
	RULE_NAME="$${EVENTBRIDGE_DAILY_NOON_RULE_NAME:-$$(cd infra && terraform output -raw eventbridge_daily_noon_rule_name)}"; \
	$(AWS_LOCAL_ENV) aws events list-targets-by-rule \
		--endpoint-url $(AWS_ENDPOINT_URL) \
		--rule "$$RULE_NAME"

verify-eventbridge-invoke-lambda:
	@set -eu; \
	LAMBDA_NAME="$${EVENTBRIDGE_DAILY_NOON_LAMBDA_NAME:-$$(cd infra && terraform output -raw eventbridge_daily_noon_lambda_name)}"; \
	$(AWS_LOCAL_ENV) aws lambda invoke \
		--endpoint-url $(AWS_ENDPOINT_URL) \
		--function-name "$$LAMBDA_NAME" \
		--cli-binary-format raw-in-base64-out \
		--payload '{"source":"manual-verification","detail":{"trigger":"make verify-eventbridge-invoke-lambda"}}' \
		$(EVENTBRIDGE_INVOKE_OUTPUT); \
	printf '\n%s\n' 'Lambda response payload:'; \
	cat $(EVENTBRIDGE_INVOKE_OUTPUT); \
	printf '\n'

verify-stepfunctions-state-machine:
	@set -eu; \
	STATE_MACHINE_ARN="$${STEPFUNCTIONS_STATE_MACHINE_ARN:-$$(cd infra && terraform output -raw stepfunctions_demo_state_machine_arn)}"; \
	$(AWS_LOCAL_ENV) aws stepfunctions describe-state-machine \
		--endpoint-url $(AWS_ENDPOINT_URL) \
		--state-machine-arn "$$STATE_MACHINE_ARN"

verify-stepfunctions-start-execution:
	@set -eu; \
	STATE_MACHINE_ARN="$${STEPFUNCTIONS_STATE_MACHINE_ARN:-$$(cd infra && terraform output -raw stepfunctions_demo_state_machine_arn)}"; \
	EXECUTION_NAME="$${STEPFUNCTIONS_EXECUTION_NAME:-demo-$$(date +%s)}"; \
	EXECUTION_ARN="$$( \
		$(AWS_LOCAL_ENV) aws stepfunctions start-execution \
			--endpoint-url $(AWS_ENDPOINT_URL) \
			--state-machine-arn "$$STATE_MACHINE_ARN" \
			--name "$$EXECUTION_NAME" \
			--input '$(STEPFUNCTIONS_INPUT)' \
			--query executionArn \
			--output text \
	)"; \
	printf 'Started execution: %s\n\n' "$$EXECUTION_ARN"; \
	$(AWS_LOCAL_ENV) aws stepfunctions describe-execution \
		--endpoint-url $(AWS_ENDPOINT_URL) \
		--execution-arn "$$EXECUTION_ARN"

verify-stepfunctions-execution-history:
	@test -n "$(EXECUTION_ARN)" || (printf '%s\n' 'Usage: make verify-stepfunctions-execution-history EXECUTION_ARN=<execution-arn>' && exit 2)
	$(AWS_LOCAL_ENV) aws stepfunctions get-execution-history \
		--endpoint-url $(AWS_ENDPOINT_URL) \
		--execution-arn "$(EXECUTION_ARN)"

fmt:
	cd infra && terraform fmt

clean:
	docker compose down -v
	rm -rf data/floci
