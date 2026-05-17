# layer_demo

Lambda Layer behavior verification workspace for Floci.

## Structure

- `applications/apis/sample-api`: API-style Lambda application.
- `applications/batches/sample-sqs-handler`: SQS batch Lambda application.
- `applications/batches/sample-eventbridge-handler`: EventBridge batch Lambda application.
- `libs/api-utils`: Shared utilities for API applications.
- `libs/batch-utils`: Shared utilities for batch applications.
- `libs/utils`: System-wide shared utilities.
- `libs/sample-function-core`: Feature-specific shared library used across applications.

## Dependency Shape

Library dependencies:

- `api-utils` imports `utils`, but expects it from a separate Lambda layer.
- `batch-utils` imports `utils`, but expects it from a separate Lambda layer.
- `sample-function-core` imports `utils`, but is bundled into function artifacts and expects `utils` from a Lambda layer.

Application dependencies:

- `sample-api` bundles `sample-function-core` and expects `utils` + `api-utils` from layers.
- `sample-sqs-handler` expects `utils` + `batch-utils` from layers.
- `sample-eventbridge-handler` expects `utils` from a layer.

Poetry dependency groups reflect that split:

- `[tool.poetry.dependencies]`: code bundled into the function or package itself.
- `[tool.poetry.group.layer-provided.dependencies]`: runtime imports supplied by Lambda layers.
- `[tool.poetry.group.dev.dependencies]`: development tools only.

## Terraform Layers

Terraform packages these Lambda layer artifacts from `infra/layer_demo_layers.tf`:

- `aws-local-sandbox-layer-demo-utils`
- `aws-local-sandbox-layer-demo-api-utils`
- `aws-local-sandbox-layer-demo-batch-utils`

Each layer zip is emitted under `infra/build/` and uses the Python Lambda layer layout:
`python/<package>`.

Terraform also packages Lambda function artifacts:

- `layer_demo_sample_api_lambda.zip`: includes `sample_api` and bundled `sample_function_core`.
- `layer_demo_sample_sqs_handler_lambda.zip`: includes only `sample_sqs_handler`.
- `layer_demo_sample_eventbridge_handler_lambda.zip`: includes only `sample_eventbridge_handler`.

Floci currently returns HTTP 405 for Lambda `PublishLayerVersion`, so Terraform keeps
actual `aws_lambda_layer_version` publishing and layer-attached demo Lambda creation disabled
by default. Set `enable_layer_demo_lambda_layer_publish=true` only when testing against an
endpoint that supports publishing and attaching Lambda layer versions.
