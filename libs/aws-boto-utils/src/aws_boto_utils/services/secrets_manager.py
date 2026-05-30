import json
from typing import Any

from botocore.client import BaseClient
from botocore.exceptions import BotoCoreError, ClientError

from aws_boto_utils.clients import create_client
from aws_boto_utils.config import AwsClientConfig
from aws_boto_utils.exceptions import AwsServiceError, SecretJsonDecodeError


class SecretsManager:
    def __init__(self, client: BaseClient) -> None:
        self._client = client

    @classmethod
    def from_config(cls, config: AwsClientConfig | None = None) -> "SecretsManager":
        return cls(create_client("secretsmanager", config))

    def get_secret_string(self, secret_id: str) -> str:
        try:
            response = self._client.get_secret_value(SecretId=secret_id)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to get secret value: {secret_id}") from error

        secret_string = response.get("SecretString")
        if secret_string is None:
            raise AwsServiceError(f"Secret does not contain SecretString: {secret_id}")

        return secret_string

    def get_secret_json(self, secret_id: str) -> dict[str, Any]:
        secret_string = self.get_secret_string(secret_id)

        try:
            value = json.loads(secret_string)
        except json.JSONDecodeError as error:
            raise SecretJsonDecodeError(f"SecretString is not valid JSON: {secret_id}") from error

        if not isinstance(value, dict):
            raise SecretJsonDecodeError(f"SecretString JSON is not an object: {secret_id}")

        return value

    def put_secret_string(self, secret_id: str, secret_string: str) -> str:
        try:
            response = self._client.put_secret_value(
                SecretId=secret_id,
                SecretString=secret_string,
            )
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to put secret value: {secret_id}") from error

        return response["VersionId"]
