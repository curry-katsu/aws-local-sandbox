SHELL := /bin/sh

AWS_ENDPOINT_URL ?= http://localhost:4566
AWS_DEFAULT_REGION ?= us-east-1
AWS_ACCESS_KEY_ID ?= test
AWS_SECRET_ACCESS_KEY ?= test
AWS_DEFAULT_OUTPUT = json
AWS_PAGER =
AWS_LOCAL_ENV = AWS_ENDPOINT_URL=$(AWS_ENDPOINT_URL) AWS_DEFAULT_REGION=$(AWS_DEFAULT_REGION) AWS_ACCESS_KEY_ID=$(AWS_ACCESS_KEY_ID) AWS_SECRET_ACCESS_KEY=$(AWS_SECRET_ACCESS_KEY) AWS_DEFAULT_OUTPUT=$(AWS_DEFAULT_OUTPUT) AWS_PAGER="$(AWS_PAGER)"

.PHONY: help up down logs ps infra-init infra-plan infra-apply infra-destroy gui-install gui-dev smoke fmt clean

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

fmt:
	cd infra && terraform fmt

clean:
	docker compose down -v
	rm -rf data/floci
