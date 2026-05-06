# cognito-user-create

Floci 上の Cognito User Pool に検証用ユーザーを作成するツールです。

## What It Does

1. `COGNITO_USER_POOL_ID` が指定されていればその User Pool を使う。
2. 未指定なら `COGNITO_USER_POOL_NAME` に一致する User Pool を探索する。
3. `admin_create_user` で検証用ユーザーを作成する。
4. `admin_get_user` で作成結果を確認する。
5. 結果を JSON で標準出力に出す。

## Defaults

Terraform の初期リソース名に合わせています。

- User Pool name: `aws-local-sandbox-user-pool`
- Endpoint: `http://localhost:4566`
- Region: `us-east-1`
- Username / email: `sandbox-user@example.com`
- Temporary password: `Sandbox123`

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

検証ツールを実行します。

```sh
poetry run cognito-user-create-verify
```

Makefile から実行する場合:

```sh
make verify-cognito-install
make verify-cognito-create-user
```

AWS CLI でログインして JWT を取得します。

```sh
make verify-cognito-login-jwt
```

## Environment Variables

必要に応じて上書きできます。

```sh
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_DEFAULT_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export COGNITO_USER_POOL_ID=us-east-1_example
export COGNITO_USER_POOL_NAME=aws-local-sandbox-user-pool
export COGNITO_USERNAME=sandbox-user@example.com
export COGNITO_USER_EMAIL=sandbox-user@example.com
export COGNITO_TEMPORARY_PASSWORD=Sandbox123
export COGNITO_PERMANENT_PASSWORD=Sandbox123
export COGNITO_SET_PERMANENT_PASSWORD=false
```

`COGNITO_SET_PERMANENT_PASSWORD=true` を指定すると、`admin_set_user_password` で恒久パスワードも設定します。
