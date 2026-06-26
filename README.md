# aws-local-sandbox

`aws-local-sandbox` is a local AWS-compatible verification environment. It uses Floci, Terraform, and a Vue 3/Vuetify GUI so AI agents and humans can create and inspect local cloud resources through the same workflow.

## Architecture

- Floci: LocalStack-compatible AWS emulator.
- Terraform: Local provisioning for S3, DynamoDB, SQS, SNS, RDS, and Cognito.
- Vue 3 + Vite + Vuetify 3: GUI for inspecting local resources and testing Cognito login.
- `libs/`: Reusable local libraries that are not tied to sandbox verification resources.
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

The demo RDS cluster is a Floci-backed PostgreSQL 17.7 database exposed through RDS-compatible APIs. Floci reports the engine as `postgres`, while the sandbox treats it as the local Aurora PostgreSQL demo target.

The RDS PostgreSQL data-access verification tool applies a sample DDL, inserts one row, and reads recent rows back from the demo database.

```sh
make verify-rds-install
make verify-rds-run
```

To run the GUI locally outside Docker Compose:

```sh
make gui-install
make gui-dev
```

## Hosted GUI

The GUI is deployed to GitHub Pages:

```text
https://curry-katsu.github.io/aws-local-sandbox/
```

Set the repository's Pages source to **GitHub Actions** once before the first
deployment. Pushes to `main` that change `gui/` then run the deployment workflow.

The hosted GUI runs entirely in the browser and connects to Floci and the debug API
on the same local machine. Start the local backend containers, then open the hosted
URL:

```sh
docker compose up -d floci debug-api
```

The browser may ask for permission to access services on the local network. The
default CORS allow-list permits only `https://curry-katsu.github.io`. Override it
for a custom Pages domain when starting Compose:

```sh
FLOCI_CORS_ALLOWED_ORIGINS=https://gui.example.com \
DEBUG_API_CORS_ALLOWED_ORIGINS=https://gui.example.com \
docker compose up -d floci debug-api
```

Use the connection settings button in the GUI app bar when Floci or debug-api uses
a different local port. The selected endpoints and region are stored in that
browser and applied after the GUI reloads.

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

SNS fanout is provisioned as one SNS topic with two SQS subscriptions.

```sh
make verify-sns-topics
make verify-sns-subscriptions
make verify-sns-fanout
```

The Cognito verification tool lives in `verification/cognito_user_create/`. It creates a local Cognito user, optionally sets a permanent password, and can request JWTs with AWS CLI.

```sh
make verify-cognito-install
make verify-cognito-create-user
make verify-cognito-login-jwt
```

## Reusable Libraries

Shared libraries live under `libs/`. They should remain usable from other projects and must not hard-code Floci endpoints, dummy credentials, Terraform resource names, or verification-only behavior.

`libs/aws-boto-utils/` is a Poetry package for common boto3 setup and small service wrappers. It currently includes helpers for Secrets Manager and SSM Parameter Store.

```sh
cd libs/aws-boto-utils
poetry install
poetry run pytest
```

## Data Persistence

Floci state is persisted in `data/floci/` when `FLOCI_STORAGE_MODE=persistent` is enabled. `make down` does not delete this data.

To remove both Docker Compose named volumes and persisted Floci data, run:

```sh
make clean
```
