# GUI Specification

## Purpose

The GUI is a local management console for resources running on Floci through the LocalStack-compatible endpoint. It is intended for local inspection, verification, and safe tuning of sandbox resources only.

## Runtime

- App path: `gui/`
- Framework: Vue 3, Vite, Vuetify 3
- Default URL: `http://localhost:5173`
- Browser AWS endpoint: `VITE_AWS_BROWSER_ENDPOINT_URL` or `/floci` through the Vite proxy
- Local debug endpoint: `/debug` through the Vite proxy to `debug-api`
- Region: `VITE_AWS_REGION` or `us-east-1`
- Credentials: dummy local keys only

Run locally:

```sh
make gui-dev
```

Validate:

```sh
cd gui && npm run build
```

## Navigation

The left navigation switches between service consoles:

- Dashboard
- S3
- DynamoDB
- SQS
- SNS
- Lambda
- RDS
- Cognito
- EventBridge
- Step Functions

Navigation is backed by Vue Router. Each service has a direct path:

- `/`
- `/s3`
- `/dynamodb`
- `/sqs`
- `/sns`
- `/lambda`
- `/rds`
- `/cognito`
- `/eventbridge`
- `/stepfunctions`

The selected service name is shown in the app bar with the active endpoint. Unknown paths render a not-found view.

## Dashboard

The Dashboard shows local connection metadata and a resource inventory discovered through AWS SDK v3 service calls.

Displayed connection metadata:

- Endpoint
- Region
- Credentials mode

Discovered resources:

- S3 buckets
- DynamoDB tables
- SQS queues
- SNS topics
- Lambda functions
- RDS clusters
- Cognito user pools and clients
- EventBridge rules
- Step Functions state machines

## Service Specifications

Detailed service-specific GUI specifications should live under `docs/specifications/gui/` to keep this overview focused on shared behavior.

- [DynamoDB Console](gui/dynamodb.md)

## S3 Console

The S3 console supports:

- Bucket listing
- Object listing with optional prefix filter
- Object content preview
- Text object creation
- Selected object deletion with confirmation

Object writes are intended for local text and JSON verification data.

## DynamoDB Console

See [DynamoDB Console](gui/dynamodb.md) for the detailed DynamoDB GUI specification.

## SQS Console

The SQS console supports:

- Queue listing
- Queue creation through a dedicated create screen
- Existing queue duplicate-name guard
- Selected queue deletion with confirmation
- Message send with arbitrary body, optional delay seconds, and JSON message attributes
- Message receive
- Selected received-message deletion
- Major queue attribute display and update

Queue creation is not inline in the list. Use `New queue` to switch the main panel to the creation screen. If the queue name already exists, the create action is disabled and `Open existing` can select the existing queue.

## SNS Console

The SNS console supports:

- Topic listing
- Topic creation through a dedicated create screen
- Existing topic duplicate-name guard
- Selected topic deletion with confirmation
- Message publish with arbitrary body, optional subject, and JSON message attributes
- Subscription listing
- DisplayName attribute update
- Raw topic attribute inspection

Topic creation is not inline in the list. Use `New topic` to switch the main panel to the creation screen. If the topic name already exists, the create action is disabled and `Open existing` can select the existing topic.

## Lambda Console

The Lambda console supports:

- Lambda function listing
- Selected function configuration inspection
- Code metadata inspection
- Request-response invocation with editable JSON payload
- Invocation status, function error, executed version, and payload inspection
- Recent Lambda log inspection for the selected local function
- Request ID filtering for loaded Lambda log events

Lambda invocation uses the local Floci endpoint and dummy credentials only. Function code is not edited from the GUI.
Lambda logs are read through the `gui/src/aws/lambdaLogs.ts` service boundary. The current local implementation calls the `debug-api` service, which reads Floci container logs through Docker. If Floci later exposes stable CloudWatch Logs APIs, replace the log service implementation/provider while keeping Vue components unchanged.

## RDS Console

The RDS console supports:

- RDS cluster listing
- Cluster status, engine, and engine version display
- Writer endpoint, reader endpoint, port, database name, master user, and Multi-AZ metadata display

The Floci demo Aurora PostgreSQL resource is backed by a local PostgreSQL container. The GUI inspects RDS metadata through AWS SDK v3 only; it does not open SQL connections from the browser.

## Cognito Console

The Cognito console supports:

- User pool and user pool client discovery
- Amplify sign-in against the local Floci Cognito endpoint
- Sign-out
- ID token and access token preview
- Decoded JWT payload inspection

The default test user and password come from `VITE_COGNITO_*` variables or local defaults.

## EventBridge Console

The EventBridge console supports:

- Scheduled rule discovery
- Target listing
- Lambda target invocation
- Invocation result inspection

The default rule is `aws-local-sandbox-daily-noon-jst` unless overridden by `VITE_EVENTBRIDGE_RULE_NAME`.

## Step Functions Console

The Step Functions console supports:

- State machine discovery
- State machine definition inspection
- Execution input editing
- Execution start
- Execution output inspection
- Execution history listing

The default state machine is `aws-local-sandbox-stepfunctions-two-lambdas` unless overridden by `VITE_STEPFUNCTIONS_STATE_MACHINE_NAME`.

## Implementation Rules

- Service screens that grow beyond simple presentation should use `gui/src/views/` as the orchestration layer and keep reusable UI under `gui/src/components/`.
- `App.vue` owns only the application shell, navigation, and `<router-view>`. It must not import individual service components or views.
- Route definitions live in `gui/src/router/` and should lazy-load service views.
- Parent-child direction should be View -> Component. Components must not import views.
- Vue components under `gui/src/components/` must contain UI state, event handlers, and presentation logic only.
- Do not import `@aws-sdk/*`, `aws-amplify`, or `aws-amplify/auth` directly from `.vue` files.
- Do not create AWS SDK clients or call `.send()` from `.vue` files.
- AWS, Amplify, and Floci access belongs under `gui/src/aws/`.
- Shared endpoint, region, and dummy credential configuration belongs in `gui/src/aws/config.ts`.
- Service-specific modules should expose small functions such as `listQueues`, `createQueue`, `deleteQueue`, or `scanTable`.
- Local-only diagnostics that require host or Docker access should go through a backend service such as `debug-api`; Vue components should call a stable GUI service module instead of depending on Docker or a specific log provider directly.
- Keep destructive actions behind confirmation dialogs.
- Do not introduce real AWS account dependencies.

## Documentation Rule

When adding or changing GUI capabilities, update this overview or the relevant service-specific specification in the same change. The documentation should describe the user-facing behavior, destructive actions, and any implementation boundary changes.
