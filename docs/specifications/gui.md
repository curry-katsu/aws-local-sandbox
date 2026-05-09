# GUI Specification

## Purpose

The GUI is a local management console for resources running on Floci through the LocalStack-compatible endpoint. It is intended for local inspection, verification, and safe tuning of sandbox resources only.

## Runtime

- App path: `gui/`
- Framework: Vue 3, Vite, Vuetify 3
- Default URL: `http://localhost:5173`
- Browser AWS endpoint: `VITE_AWS_BROWSER_ENDPOINT_URL` or `/floci` through the Vite proxy
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
- Cognito
- EventBridge
- Step Functions

The selected service name is shown in the app bar with the active endpoint.

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
- Cognito user pools and clients
- EventBridge rules
- Step Functions state machines

## S3 Console

The S3 console supports:

- Bucket listing
- Object listing with optional prefix filter
- Object content preview
- Text object creation
- Selected object deletion with confirmation

Object writes are intended for local text and JSON verification data.

## DynamoDB Console

The DynamoDB console supports:

- Table listing
- Table metadata summary
- Key schema and attribute definition display
- Item scan with configurable limit
- JSON item creation through `PutItem`
- Selected item deletion with confirmation
- Selected item JSON inspection

The item table keeps rows compact:

- Long values are shown as single-line ellipsized cells.
- Full item JSON is shown in the `Selected item JSON` panel after selecting a row.

## SQS Console

The SQS console supports:

- Queue listing
- Queue creation through a dedicated create screen
- Existing queue duplicate-name guard
- Selected queue deletion with confirmation
- Message send
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
- Message publish
- Subscription listing
- DisplayName attribute update
- Raw topic attribute inspection

Topic creation is not inline in the list. Use `New topic` to switch the main panel to the creation screen. If the topic name already exists, the create action is disabled and `Open existing` can select the existing topic.

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

- Vue components under `gui/src/components/` must contain UI state, event handlers, and presentation logic only.
- Do not import `@aws-sdk/*`, `aws-amplify`, or `aws-amplify/auth` directly from `.vue` files.
- Do not create AWS SDK clients or call `.send()` from `.vue` files.
- AWS, Amplify, and Floci access belongs under `gui/src/aws/`.
- Shared endpoint, region, and dummy credential configuration belongs in `gui/src/aws/config.ts`.
- Service-specific modules should expose small functions such as `listQueues`, `createQueue`, `deleteQueue`, or `scanTable`.
- Keep destructive actions behind confirmation dialogs.
- Do not introduce real AWS account dependencies.

## Documentation Rule

When adding or changing GUI capabilities, update this specification in the same change. The documentation should describe the user-facing behavior, destructive actions, and any implementation boundary changes.

