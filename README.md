# aws-local-sandbox

AWS 互換のローカル検証環境です。Floci、Terraform、Vue 3/Vuetify の GUI を使い、AI エージェントと人間が同じ手順でローカルクラウドリソースを作成・確認できます。

## 構成

- Floci: LocalStack 互換 AWS エミュレータ
- Terraform: S3、DynamoDB、SQS のローカル作成
- Vue 3 + Vite + Vuetify 3: ローカルリソース確認 GUI
- Makefile: 起動、停止、IaC、GUI 操作の共通入口

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

ローカルで GUI を起動する場合:

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

SQS から message を読み取り、DynamoDB に保存し、処理ログ JSON を S3 にアップロードする検証ツールを `verification/sqs_to_dynamodb_s3_log/` に配置しています。

```sh
make verify-install
make verify-send-message
make verify-run
make verify-dynamodb-scan
make verify-s3-ls
make verify-s3-cat FILE=verification-logs/YYYY/MM/DD/<run-id>.json
```

## Data Persistence

Floci の状態は `FLOCI_STORAGE_MODE=persistent` で `data/floci/` に永続化されます。`make down` では削除されません。

Docker Compose の named volume と Floci の永続化データをまとめて削除する場合は次を実行します。

```sh
make clean
```
