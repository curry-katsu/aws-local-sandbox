# aws-boto-utils

Reusable boto3 helper library for application and verification code that should not need to repeat AWS client setup patterns.

This package is intentionally independent from `aws-local-sandbox`. It does not hard-code Floci, LocalStack, dummy credentials, local endpoints, resource names, or verification-specific behavior. Callers pass region, endpoint, profile, and credentials explicitly when they need non-default AWS behavior.

## Install

From another Poetry project in this repository:

```sh
poetry add --editable ../../libs/aws-boto-utils
```

Or with a normal path dependency:

```toml
[project]
dependencies = [
  "aws-boto-utils @ file:///${PROJECT_ROOT}/libs/aws-boto-utils",
]
```

## Usage

```python
from aws_boto_utils import AwsClientConfig
from aws_boto_utils.services import (
    CognitoUserPoolAdmin,
    DynamoDbClient,
    S3Client,
    SecretsManager,
    SsmParameterStore,
)

config = AwsClientConfig(
    region_name="us-east-1",
    endpoint_url="http://localhost:4566",
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

secrets = SecretsManager.from_config(config)
secret = secrets.get_secret_json("aws-local-sandbox/sample-secret")

parameters = SsmParameterStore.from_config(config)
value = parameters.get_parameter("/aws-local-sandbox/sample/config")

dynamodb = DynamoDbClient.from_config(config)
dynamodb.put_item(
    "aws-local-sandbox-table",
    {"pk": "ITEM#1", "sk": "PROFILE", "message": "hello"},
)
item = dynamodb.get_item(
    "aws-local-sandbox-table",
    {"pk": "ITEM#1", "sk": "PROFILE"},
    consistent_read=True,
)

s3 = S3Client.from_config(config)
s3.put_object(
    "aws-local-sandbox-bucket",
    "samples/hello.json",
    '{"message":"hello"}',
    content_type="application/json",
)

cognito = CognitoUserPoolAdmin.from_config(config)
user_pool_id = cognito.find_user_pool_id("aws-local-sandbox-user-pool")
user, already_exists = cognito.admin_create_user_if_missing(
    user_pool_id,
    "sandbox-user@example.com",
    temporary_password="Sandbox123",
    user_attributes={"email": "sandbox-user@example.com", "email_verified": "true"},
)
```

## Design Notes

- Keep boto3 visible enough that callers can still use native clients when needed.
- Centralize session and client creation so endpoint, region, profile, and credentials are handled consistently.
- Wrap common DynamoDB, Secrets Manager, and SSM Parameter Store operations with typed return values and predictable errors.
- Keep tests independent from AWS emulators by using `botocore.stub.Stubber`.
