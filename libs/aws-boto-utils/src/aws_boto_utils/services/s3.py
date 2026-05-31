from pathlib import Path
from typing import Any

from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from aws_boto_utils.clients import create_client
from aws_boto_utils.config import AwsClientConfig
from aws_boto_utils.exceptions import AwsServiceError


class S3Client:
    def __init__(self, client: Any) -> None:
        self._client = client

    @classmethod
    def from_config(
        cls,
        config: AwsClientConfig | None = None,
        *,
        path_style: bool = True,
    ) -> "S3Client":
        botocore_config = Config(
            retries={"max_attempts": 3, "mode": "standard"},
            s3={"addressing_style": "path" if path_style else "virtual"},
        )
        return cls(create_client("s3", config, config=botocore_config))

    def list_buckets(self) -> list[dict[str, Any]]:
        try:
            response = self._client.list_buckets()
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError("Failed to list S3 buckets") from error

        return list(response.get("Buckets", []))

    def list_objects(
        self,
        bucket: str,
        *,
        prefix: str | None = None,
        max_keys: int | None = None,
    ) -> list[dict[str, Any]]:
        paginator = self._client.get_paginator("list_objects_v2")
        params: dict[str, Any] = {"Bucket": bucket}
        if prefix is not None:
            params["Prefix"] = prefix
        if max_keys is not None:
            params["PaginationConfig"] = {"MaxItems": max_keys}

        objects: list[dict[str, Any]] = []
        try:
            for page in paginator.paginate(**params):
                objects.extend(page.get("Contents", []))
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to list S3 objects: {bucket}") from error

        return objects

    def get_object_bytes(self, bucket: str, key: str) -> bytes:
        try:
            response = self._client.get_object(Bucket=bucket, Key=key)
            body = response["Body"]
            return body.read()
        except (BotoCoreError, ClientError, KeyError) as error:
            raise AwsServiceError(f"Failed to get S3 object: s3://{bucket}/{key}") from error

    def get_object_text(self, bucket: str, key: str, *, encoding: str = "utf-8") -> str:
        return self.get_object_bytes(bucket, key).decode(encoding)

    def put_object(
        self,
        bucket: str,
        key: str,
        body: bytes | str,
        *,
        content_type: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "Bucket": bucket,
            "Key": key,
            "Body": body,
        }
        if content_type:
            params["ContentType"] = content_type

        try:
            return self._client.put_object(**params)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to put S3 object: s3://{bucket}/{key}") from error

    def upload_file(
        self,
        filename: str | Path,
        bucket: str,
        key: str,
        *,
        extra_args: dict[str, Any] | None = None,
    ) -> None:
        try:
            self._client.upload_file(
                Filename=str(filename),
                Bucket=bucket,
                Key=key,
                ExtraArgs=extra_args,
            )
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to upload S3 object: s3://{bucket}/{key}") from error

    def delete_object(self, bucket: str, key: str) -> None:
        try:
            self._client.delete_object(Bucket=bucket, Key=key)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to delete S3 object: s3://{bucket}/{key}") from error
