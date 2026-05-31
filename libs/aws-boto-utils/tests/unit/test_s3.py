from io import BytesIO
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from aws_boto_utils.exceptions import AwsServiceError
from aws_boto_utils.services import S3Client


def test_list_buckets_returns_buckets() -> None:
    client = MagicMock()
    client.list_buckets.return_value = {"Buckets": [{"Name": "sample-bucket"}]}

    assert S3Client(client).list_buckets() == [{"Name": "sample-bucket"}]


def test_list_objects_uses_paginator() -> None:
    paginator = MagicMock()
    paginator.paginate.return_value = [
        {"Contents": [{"Key": "logs/1.json"}]},
        {"Contents": [{"Key": "logs/2.json"}]},
    ]
    client = MagicMock()
    client.get_paginator.return_value = paginator

    objects = S3Client(client).list_objects("sample-bucket", prefix="logs/", max_keys=2)

    assert objects == [{"Key": "logs/1.json"}, {"Key": "logs/2.json"}]
    client.get_paginator.assert_called_once_with("list_objects_v2")
    paginator.paginate.assert_called_once_with(
        Bucket="sample-bucket",
        Prefix="logs/",
        PaginationConfig={"MaxItems": 2},
    )


def test_get_object_text_decodes_body() -> None:
    client = MagicMock()
    client.get_object.return_value = {"Body": BytesIO("hello".encode("utf-8"))}

    assert S3Client(client).get_object_text("sample-bucket", "hello.txt") == "hello"


def test_put_object_wraps_client_errors() -> None:
    client = MagicMock()
    client.put_object.side_effect = ClientError(
        {"Error": {"Code": "AccessDenied", "Message": "denied"}},
        "PutObject",
    )

    with pytest.raises(AwsServiceError, match="Failed to put S3 object"):
        S3Client(client).put_object("sample-bucket", "hello.txt", "hello")
