import boto3
from botocore.stub import Stubber

from aws_boto_utils.services import SsmParameterStore


def test_get_parameter_returns_value() -> None:
    client = boto3.client("ssm", region_name="us-east-1")
    stubber = Stubber(client)
    stubber.add_response(
        "get_parameter",
        {
            "Parameter": {
                "Name": "/sample/config",
                "Type": "String",
                "Value": "sandbox-config-value",
                "Version": 1,
            }
        },
        {"Name": "/sample/config", "WithDecryption": True},
    )

    with stubber:
        assert SsmParameterStore(client).get_parameter("/sample/config") == "sandbox-config-value"
