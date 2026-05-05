# sqs-to-dynamodb-s3-log

Floci 上の SQS / DynamoDB / S3 が連携して動くことを確認するための検証ツールです。

## What It Does

1. SQS queue から message を読み取る。
2. 読み取った message body を DynamoDB table に保存する。
3. 処理時間、件数、保存先などを含む JSON log を `logs/` に出力する。
4. 同じ JSON log を S3 bucket にアップロードする。
5. DynamoDB と S3 への保存に成功した message を SQS から削除する。

## Defaults

Terraform の初期リソース名に合わせています。

- SQS queue: `aws-local-sandbox-queue`
- DynamoDB table: `aws-local-sandbox-table`
- S3 bucket: `aws-local-sandbox-bucket`
- Endpoint: `http://localhost:4566`
- Region: `us-east-1`

## Setup

```sh
poetry install
```

## Run

事前に Floci と Terraform リソースを起動・作成してください。

```sh
make up
make infra-apply
```

テスト message を SQS に投入します。

```sh
make verify-send-message
```

検証ツールを実行します。

```sh
poetry run sqs-ddb-s3-verify
```

DynamoDB に保存された item と S3 に保存された log file を確認します。

```sh
make verify-dynamodb-scan
make verify-s3-ls
make verify-s3-cat FILE=verification-logs/YYYY/MM/DD/<run-id>.json
```

## Development Checks

```sh
poetry run black --check .
poetry run isort --check-only .
poetry run flake8 .
```

## Environment Variables

必要に応じて上書きできます。

```sh
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_DEFAULT_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export SQS_QUEUE_NAME=aws-local-sandbox-queue
export DYNAMODB_TABLE_NAME=aws-local-sandbox-table
export S3_BUCKET_NAME=aws-local-sandbox-bucket
export MAX_MESSAGES=10
export WAIT_TIME_SECONDS=2
export LOG_PREFIX=verification-logs
```
