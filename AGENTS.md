# AGENTS.md

## Repository Purpose

`aws-local-sandbox` is a local AWS-compatible sandbox for AI-assisted development. It uses Floci as a LocalStack-compatible emulator, Terraform for provisioning, and a Vue 3/Vuetify GUI for inspecting local resources.

## Top-Level Structure

- `docker-compose.yml`: Starts Floci on port `4566` and the Vue GUI on port `5173`.
- `Makefile`: Canonical task runner for agents and humans.
- `infra/`: Terraform configuration targeting Floci.
- `gui/`: Vue 3 + Vite + Vuetify 3 management console.
- `data/floci/`: Local persisted Floci state created at runtime.

## Toolchain

- Docker / Docker Compose
- Terraform
- Node.js 22 or compatible
- npm
- AWS CLI v2
- Floci Docker image: `floci/floci:latest`

## Environment

Use dummy credentials only. Never use production AWS credentials in this repo.

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

## Agent Workflow

1. Inspect current state with `git status --short` before editing.
2. Start services with `make up`.
3. Initialize Terraform with `make infra-init` if `.terraform/` does not exist.
4. Apply local infrastructure with `make infra-apply`.
5. Run the GUI with either Docker Compose or `make gui-dev`.
6. Validate changes with the smallest relevant command:
   - Terraform: `terraform fmt`, `make infra-plan`
   - GUI: `cd gui && npm run build`
   - End-to-end smoke: `make smoke`

## Coding Boundaries

- Keep infrastructure changes in `infra/`.
- Keep browser GUI changes in `gui/`.
- Do not remove local endpoint settings from Terraform or AWS SDK clients.
- Do not introduce real cloud account dependencies.
- Prefer AWS SDK v3 modular clients.
- Prefer small, explicit Make targets over hidden shell scripts.

## Local AWS Connection Contract

All tools must talk to:

- Endpoint: `http://localhost:4566`
- Region: `us-east-1`
- Access key: `test`
- Secret key: `test`
- Storage mode: `persistent`
- Storage path: `/app/data`, mounted from `./data/floci`

Terraform uses `provider.tf`. The GUI uses `VITE_*` variables. AWS CLI commands should pass `--endpoint-url http://localhost:4566` or set `AWS_ENDPOINT_URL`.
