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
S3_BUCKET_NAME ?= aws-local-sandbox-bucket
S3_LOG_PREFIX ?= verification-logs
VERIFY_MESSAGE_BODY ?= {"source":"make","message":"hello from aws-local-sandbox"}

.PHONY: help up down logs ps infra-init infra-plan infra-apply infra-destroy gui-install gui-dev smoke verify-install verify-send-message verify-run verify-dynamodb-scan verify-s3-ls verify-s3-cat verify-format verify-lint fmt clean

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
		'  make verify-dynamodb-scan Scan verification DynamoDB table items' \
		'  make verify-s3-ls   List verification log files in S3' \
		'  make verify-s3-cat FILE=<key> Print an S3 object body' \
		'  make verify-format Format verification Python code with black and isort' \
		'  make verify-lint   Lint verification Python code with black, isort, and flake8' \
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
	cd gui && VITE_AWS_ENDPOINT_URL=$(AWS_ENDPOINT_URL) VITE_AWS_REGION=$(AWS_DEFAULT_REGION) VITE_AWS_ACCESS_KEY_ID=$(AWS_ACCESS_KEY_ID) VITE_AWS_SECRET_ACCESS_KEY=$(AWS_SECRET_ACCESS_KEY) npm run dev

smoke:
	$(AWS_LOCAL_ENV) aws s3 ls --endpoint-url $(AWS_ENDPOINT_URL)
	$(AWS_LOCAL_ENV) aws dynamodb list-tables --endpoint-url $(AWS_ENDPOINT_URL)
	$(AWS_LOCAL_ENV) aws sqs list-queues --endpoint-url $(AWS_ENDPOINT_URL)

verify-install:
	cd verification/sqs_to_dynamodb_s3_log && poetry install

verify-send-message:
	$(AWS_LOCAL_ENV) aws sqs send-message --endpoint-url $(AWS_ENDPOINT_URL) --queue-url $(SQS_QUEUE_URL) --message-body '$(VERIFY_MESSAGE_BODY)'

verify-run:
	cd verification/sqs_to_dynamodb_s3_log && $(AWS_LOCAL_ENV) poetry run sqs-ddb-s3-verify

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

fmt:
	cd infra && terraform fmt

clean:
	docker compose down -v
	rm -rf data/floci
