# aws-local-sandbox

`aws-local-sandbox` is a local AWS-compatible verification environment. It uses Floci, Terraform, and a Vue 3/Vuetify GUI so AI agents and humans can create and inspect local cloud resources through the same workflow.

## Architecture

- Floci: LocalStack-compatible AWS emulator.
- Terraform: Local provisioning for S3, DynamoDB, SQS, and Cognito.
- Vue 3 + Vite + Vuetify 3: GUI for inspecting local resources and testing Cognito login.
- Makefile: Shared entry point for service lifecycle, IaC, GUI, and verification tasks.

## Quick Start

```sh
make up
make infra-init
make infra-apply
```

GUI:

```sh
open http://localhost:5173
```

The GUI includes an Amplify login verification panel for the Cognito User Pool. Create the verification user before signing in from the GUI.

```sh
make verify-cognito-install
make verify-cognito-login-jwt
```

To run the GUI locally outside Docker Compose:

```sh
make gui-install
make gui-dev
```

## Environment

```sh
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_DEFAULT_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
```

## Smoke Test

```sh
make smoke
```

## Verification Tool

The SQS / DynamoDB / S3 verification tool lives in `verification/sqs_to_dynamodb_s3_log/`. It reads messages from SQS, writes them to DynamoDB, and uploads JSON processing logs to S3.

```sh
make verify-install
make verify-send-message
make verify-run
make verify-dynamodb-scan
make verify-s3-ls
make verify-s3-cat FILE=verification-logs/YYYY/MM/DD/<run-id>.json
```

The Cognito verification tool lives in `verification/cognito_user_create/`. It creates a local Cognito user, optionally sets a permanent password, and can request JWTs with AWS CLI.

```sh
make verify-cognito-install
make verify-cognito-create-user
make verify-cognito-login-jwt
```

## Data Persistence

Floci state is persisted in `data/floci/` when `FLOCI_STORAGE_MODE=persistent` is enabled. `make down` does not delete this data.

To remove both Docker Compose named volumes and persisted Floci data, run:

```sh
make clean
```
