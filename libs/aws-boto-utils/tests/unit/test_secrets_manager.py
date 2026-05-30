import json

import boto3
import pytest
from botocore.stub import Stubber

from aws_boto_utils.exceptions import SecretJsonDecodeError
from aws_boto_utils.services import SecretsManager

SECRET_VERSION_ID = "00000000-0000-0000-0000-000000000001"


def test_get_secret_json_returns_object() -> None:
    client = boto3.client("secretsmanager", region_name="us-east-1")
    stubber = Stubber(client)
    stubber.add_response(
        "get_secret_value",
        {
            "ARN": "arn:aws:secretsmanager:us-east-1:000000000000:secret:sample",
            "Name": "sample",
            "VersionId": SECRET_VERSION_ID,
            "SecretString": json.dumps({"username": "sandbox-user"}),
            "VersionStages": ["AWSCURRENT"],
            "CreatedDate": 1,
        },
        {"SecretId": "sample"},
    )

    with stubber:
        assert SecretsManager(client).get_secret_json("sample") == {"username": "sandbox-user"}


def test_get_secret_json_rejects_non_object_json() -> None:
    client = boto3.client("secretsmanager", region_name="us-east-1")
    stubber = Stubber(client)
    stubber.add_response(
        "get_secret_value",
        {
            "ARN": "arn:aws:secretsmanager:us-east-1:000000000000:secret:sample",
            "Name": "sample",
            "VersionId": SECRET_VERSION_ID,
            "SecretString": json.dumps(["not", "object"]),
            "VersionStages": ["AWSCURRENT"],
            "CreatedDate": 1,
        },
        {"SecretId": "sample"},
    )

    with stubber:
        with pytest.raises(SecretJsonDecodeError):
            SecretsManager(client).get_secret_json("sample")
