# CLAUDE.md

This repository is a verification environment that uses Floci as an AWS-compatible local emulator. Claude Code should extend the Terraform configuration and Vue GUI in small, safe increments without breaking the existing setup.

## Basic Commands

- Start services: `make up`
- Stop services: `make down`
- View logs: `make logs`
- Initialize Terraform: `make infra-init`
- Terraform plan: `make infra-plan`
- Terraform apply: `make infra-apply`
- Terraform destroy: `make infra-destroy`
- Install GUI dependencies: `make gui-install`
- Run the GUI locally: `make gui-dev`
- AWS CLI smoke test: `make smoke`
- Install SQS / DynamoDB / S3 verification dependencies: `make verify-install`
- Send a verification SQS message: `make verify-send-message`
- Run SQS -> DynamoDB -> S3 log verification: `make verify-run`
- Scan verification DynamoDB data: `make verify-dynamodb-scan`
- List S3 verification logs: `make verify-s3-ls`
- Read an S3 verification log: `make verify-s3-cat FILE=verification-logs/YYYY/MM/DD/<run-id>.json`
- Install Cognito verification dependencies: `make verify-cognito-install`
- Create a Cognito verification user: `make verify-cognito-create-user`
- Log in to Cognito and print JWTs: `make verify-cognito-login-jwt`

## Environment Variables

Floci uses the LocalStack-compatible single endpoint `http://localhost:4566`. Do not use real AWS credentials.

```sh
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_DEFAULT_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export VITE_AWS_ENDPOINT_URL=http://localhost:4566
export VITE_AWS_REGION=us-east-1
export VITE_AWS_ACCESS_KEY_ID=test
export VITE_AWS_SECRET_ACCESS_KEY=test
```

## Terraform Guidelines

- Keep Terraform files under `infra/`.
- Always use the LocalStack/Floci-compatible endpoint settings in `provider.tf`.
- Keep `skip_credentials_validation`, `skip_metadata_api_check`, and `skip_requesting_account_id` enabled for local verification.
- Keep `s3_use_path_style = true` because the local S3 endpoint uses path-style addressing.
- Use clear local resource names such as `aws-local-sandbox-*` or `local-*`.
- Run `terraform fmt` and `terraform plan` after Terraform changes.

## Vue/Vuetify Guidelines

- The GUI is a Vue 3 + Vite + Vuetify 3 app under `gui/`.
- Vue components under `gui/src/components/` should implement UI state, event handlers, and presentation only.
- Do not import `@aws-sdk/*`, `aws-amplify`, or `aws-amplify/auth` directly from `.vue` files.
- Do not create AWS SDK clients or call `.send()` directly from `.vue` files.
- Put browser AWS, Amplify, and Floci access in service modules under `gui/src/aws/`.
- Keep shared endpoint, region, and dummy credential configuration in `gui/src/aws/config.ts`.
- Read browser-facing endpoint and credential settings from `VITE_*` environment variables.
- Use the Vite `/floci` proxy for browser calls to Floci when direct `localhost:4566` access would hit CORS or browser-network limits.
- Treat the GUI as a management console: keep it dense, operational, and avoid unnecessary marketing-style UI.
- Keep destructive GUI actions behind confirmation dialogs.
- When adding, removing, or changing GUI behavior, update `docs/specifications/gui.md` in the same change.
- Run `npm run build` after GUI changes.

## HOW-TO

1. Run `make up` to start the Floci and GUI containers.
2. Run `make infra-init` once.
3. Run `make infra-apply` to create local S3, DynamoDB, SQS, and Cognito verification resources.
4. Open `http://localhost:5173` and inspect resources from the GUI.
5. Use `make smoke` for an AWS CLI smoke test.
6. For SQS / DynamoDB / S3 integration, use the Poetry project in `verification/sqs_to_dynamodb_s3_log/` and run `make verify-install`, `make verify-send-message`, then `make verify-run`.
7. Inspect verification output with `make verify-dynamodb-scan`, `make verify-s3-ls`, and `make verify-s3-cat FILE=<key>`.
8. For Cognito, run `make verify-cognito-install` and `make verify-cognito-login-jwt`, then use the GUI Cognito login panel to verify Amplify sign-in and JWT issuance.

## Notes

- Do not remove Terraform provider endpoint settings. They prevent accidental apply operations against real AWS.
- `data/floci/` is the Floci persistent data directory used with `FLOCI_STORAGE_MODE=persistent`. Do not commit it in normal workflows.
- The Docker socket mount is required by some Floci features. Keep it in the baseline configuration even if a specific task does not use it.
