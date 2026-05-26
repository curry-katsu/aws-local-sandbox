# DynamoDB Data Access Verification

This tool verifies Python DynamoDB access against the local Floci endpoint.

It uses:

- `DynamoDbClient`: a small boto3 resource wrapper
- `BaseDynamoDao`: a reusable DAO base class
- `SandboxTableDao`: a concrete DAO for `aws-local-sandbox-table`

## Run

```sh
make verify-dynamodb-install
make verify-dynamodb-run
```

By default the verification writes three items, reads and updates one item, queries by `pk`,
scans for `DONE` items, and deletes the written items.

To keep written items for GUI inspection:

```sh
DYNAMODB_KEEP_ITEMS=true make verify-dynamodb-run
```

## Index and TTL verification

Apply the Terraform resources first:

```sh
make infra-apply
```

Then run:

```sh
make verify-dynamodb-index-ttl-run
```

This verifies:

- LSI query through `lsi-by-lsi-sk`
- GSI query through `gsi-by-gsi-pk-sk`
- Sparse GSI query through `gsi-sparse-by-status`
- TTL expiration detection by scanning expired `ttl_epoch` values
- TTL automatic deletion after `DYNAMODB_TTL_WAIT_SECONDS`

TTL deletion is asynchronous in DynamoDB, so the automatic deletion result is reported separately
from expiration detection.

## Environment

- `AWS_ENDPOINT_URL`, default: `http://localhost:4566`
- `AWS_DEFAULT_REGION`, default: `us-east-1`
- `AWS_ACCESS_KEY_ID`, default: `test`
- `AWS_SECRET_ACCESS_KEY`, default: `test`
- `DYNAMODB_TABLE_NAME`, default: `aws-local-sandbox-table`
- `DYNAMODB_INDEX_TTL_TABLE_NAME`, default: `aws-local-sandbox-index-ttl-table`
- `DYNAMODB_KEEP_ITEMS`, default: `false`
- `DYNAMODB_TTL_WAIT_SECONDS`, default: `10`
