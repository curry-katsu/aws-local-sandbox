# CLAUDE.md

このリポジトリは、Floci を AWS 互換ローカルエミュレータとして使う検証環境です。Claude Code は、既存の構成を壊さずに Terraform と Vue GUI を小さく安全に拡張してください。

## 基本コマンド

- 起動: `make up`
- 停止: `make down`
- ログ確認: `make logs`
- Terraform 初期化: `make infra-init`
- Terraform plan: `make infra-plan`
- Terraform apply: `make infra-apply`
- Terraform destroy: `make infra-destroy`
- GUI 依存関係インストール: `make gui-install`
- GUI ローカル起動: `make gui-dev`
- AWS CLI スモークテスト: `make smoke`

## 環境変数

Floci は LocalStack 互換の単一エンドポイント `http://localhost:4566` を使います。実 AWS 認証情報は使わないでください。

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

## Terraform 作業規約

- Terraform ファイルは `infra/` 配下に置く。
- Provider は必ず `provider.tf` の LocalStack/Floci 互換 endpoint 設定を使う。
- ローカル検証用のため、`skip_credentials_validation`、`skip_metadata_api_check`、`skip_requesting_account_id` を有効にする。
- S3 は path-style を使うため `s3_use_path_style = true` を維持する。
- リソース名は `aws-local-sandbox-*` または `local-*` のように用途が分かる名前にする。
- 変更後は `terraform fmt` と `terraform plan` を実行する。

## Vue/Vuetify 作業規約

- GUI は `gui/` 配下の Vue 3 + Vite + Vuetify 3 アプリ。
- AWS SDK v3 の client はコンポーネント内で直接増やしすぎず、規模が大きくなったら `src/services/aws.js` に分離する。
- ブラウザから Floci にアクセスするため、endpoint と認証情報は `VITE_*` 環境変数から読む。
- 画面は管理コンソールとして、情報密度を高め、余計なマーケティング風 UI は避ける。
- 変更後は `npm run build` を実行する。

## HOW-TO

1. `make up` で Floci と GUI コンテナを起動する。
2. `make infra-init` を一度だけ実行する。
3. `make infra-apply` で S3、DynamoDB、SQS の検証リソースを作成する。
4. `http://localhost:5173` を開き、GUI からリソース一覧を確認する。
5. AWS CLI で確認する場合は `make smoke` を使う。

## 注意

- 実 AWS に対する apply を防ぐため、Terraform provider の endpoint 設定を外さない。
- `data/floci/` は Floci の永続化データ領域。`FLOCI_STORAGE_MODE=persistent` で使われる。通常はコミットしない。
- Docker socket mount は一部の Floci 機能で必要になる。不要な場合でも初期構成では維持する。
