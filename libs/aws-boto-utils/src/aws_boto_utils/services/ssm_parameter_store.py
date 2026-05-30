from typing import Any

from botocore.client import BaseClient
from botocore.exceptions import BotoCoreError, ClientError

from aws_boto_utils.clients import create_client
from aws_boto_utils.config import AwsClientConfig
from aws_boto_utils.exceptions import AwsServiceError


class SsmParameterStore:
    def __init__(self, client: BaseClient) -> None:
        self._client = client

    @classmethod
    def from_config(cls, config: AwsClientConfig | None = None) -> "SsmParameterStore":
        return cls(create_client("ssm", config))

    def get_parameter(self, name: str, *, with_decryption: bool = True) -> str:
        try:
            response = self._client.get_parameter(Name=name, WithDecryption=with_decryption)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to get parameter: {name}") from error

        return response["Parameter"]["Value"]

    def put_parameter(
        self,
        name: str,
        value: str,
        *,
        parameter_type: str = "String",
        overwrite: bool = True,
    ) -> int:
        try:
            response = self._client.put_parameter(
                Name=name,
                Value=value,
                Type=parameter_type,
                Overwrite=overwrite,
            )
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to put parameter: {name}") from error

        return response["Version"]

    def get_parameters_by_path(
        self,
        path: str,
        *,
        recursive: bool = True,
        with_decryption: bool = True,
    ) -> list[dict[str, Any]]:
        paginator = self._client.get_paginator("get_parameters_by_path")
        parameters: list[dict[str, Any]] = []

        try:
            for page in paginator.paginate(
                Path=path,
                Recursive=recursive,
                WithDecryption=with_decryption,
            ):
                parameters.extend(page.get("Parameters", []))
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to get parameters by path: {path}") from error

        return parameters
