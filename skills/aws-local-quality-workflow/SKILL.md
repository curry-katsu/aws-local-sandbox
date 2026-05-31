---
name: aws-local-quality-workflow
description: Use when making or reviewing changes in the aws-local-sandbox repository, especially Terraform, Vue GUI, AWS SDK service modules, verification utilities, Make targets, Docker Compose, or local Floci workflows. This skill stabilizes work quality by enforcing repository boundaries, local AWS safety, and the smallest relevant validation command before finishing.
---

# AWS Local Quality Workflow

## Purpose

Use this skill to keep changes in `aws-local-sandbox` small, local-only, and verifiable. It turns the repository rules into a practical pre-edit, implementation, and validation workflow.

## Start Every Change

1. Run `git status --short` and keep unrelated user changes intact.
2. Identify the affected area:
   - Terraform: `infra/`
   - GUI: `gui/`
   - GUI specification: `docs/specifications/`
   - Verification utilities: nested directories under `verification/`
   - Local orchestration: `Makefile`, `docker-compose.yml`, `debug-api/`
3. Preserve the local AWS contract:
   - Endpoint: `http://localhost:4566`
   - Region: `us-east-1`
   - Access key: `test`
   - Secret key: `test`
   - No real AWS account dependency

## Implementation Boundaries

### Terraform

- Keep Terraform changes under `infra/`.
- Do not remove Floci/LocalStack-compatible provider settings.
- Keep local safety flags such as credential and metadata checks disabled.
- Keep local S3 path-style addressing enabled.
- Prefer explicit local resource names such as `aws-local-sandbox-*` or `local-*`.
- Validate with `terraform fmt` and `make infra-plan` when Terraform changes.

### Vue GUI

- Keep browser GUI changes under `gui/`.
- `.vue` files may own UI state, event handlers, and presentation.
- `.vue` files must not import `@aws-sdk/*`, `aws-amplify`, or `aws-amplify/auth`.
- `.vue` files must not create AWS SDK clients or call `.send()`.
- Put AWS, Amplify, and Floci access in service modules under `gui/src/aws/`.
- Keep endpoint, region, and dummy credential config in `gui/src/aws/config.ts`.
- Route-level orchestration belongs in `gui/src/views/`; reusable UI belongs in `gui/src/components/`.
- Keep destructive GUI actions behind confirmation dialogs.
- Validate with `cd gui && npm run build` when GUI code changes.
- When GUI test code exists or a test script has been added to `gui/package.json`, also run the smallest relevant GUI test command with coverage enabled.
- Prefer a GUI test script that emits HTML coverage to `gui/coverage/`, for example `cd gui && npm run test -- --coverage` when the test runner supports it.

### Shared Libraries

- Keep reusable Python library code under `libs/`.
- Preserve local endpoint and dummy credential defaults in shared AWS helpers.
- When changing a library package, run that package's pytest suite with coverage enabled.
- For `libs/aws-boto-utils`, use `cd libs/aws-boto-utils && poetry run pytest`; pytest configuration emits terminal coverage and HTML coverage under `libs/aws-boto-utils/coverage/`.
- If a library test command is unavailable because dependencies are not installed, state the missing dependency step and the residual risk.

### Verification Utilities

- Keep each verification tool in its own nested directory under `verification/`.
- Do not place `main.py` directly under `verification/`.
- Prefer explicit Make targets for install, run, and inspection steps.
- Use AWS SDK/CLI clients configured for `http://localhost:4566` with dummy credentials.
- Validate with the smallest relevant verification target, for example:
  - `make verify-install`
  - `make verify-send-message`
  - `make verify-run`
  - service-specific targets such as `make verify-dynamodb-run`

### Make and Docker

- Prefer small, explicit Make targets over hidden shell scripts.
- Keep Docker Compose focused on local Floci, GUI, and local support services.
- Do not introduce external cloud or hosted-service requirements.

## Validation Matrix

Choose the smallest command that proves the changed behavior:

- Terraform formatting only: `terraform fmt`
- Terraform provisioning behavior: `make infra-plan`
- GUI code or build behavior: `cd gui && npm run build`
- GUI tests, when `gui/package.json` defines them: run the test script with coverage enabled and write HTML coverage to `gui/coverage/`
- Python library behavior: `cd libs/aws-boto-utils && poetry run pytest`
- End-to-end local AWS smoke: `make smoke`
- SQS/DynamoDB/S3 workflow: `make verify-install`, `make verify-send-message`, then `make verify-run`
- Verification outputs: `make verify-dynamodb-scan`, `make verify-s3-ls`, `make verify-s3-cat FILE=<key>`

If a command cannot be run because services or dependencies are missing, state that explicitly and explain the remaining risk.

## Finish Criteria

Before finishing:

- Confirm local AWS endpoint and dummy credential assumptions are still intact.
- Confirm changed behavior has an appropriate validation command.
- For GUI behavior changes, also use the `$aws-local-spec-sync` skill and update the relevant specification.
- Summarize changed files and validation results clearly.
