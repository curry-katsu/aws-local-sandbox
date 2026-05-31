from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from aws_boto_utils.exceptions import AwsServiceError
from aws_boto_utils.services import CognitoUserPoolAdmin


def test_find_user_pool_id_returns_matching_pool() -> None:
    client = MagicMock()
    client.list_user_pools.return_value = {
        "UserPools": [
            {"Id": "pool-1", "Name": "other"},
            {"Id": "pool-2", "Name": "sample"},
        ]
    }

    assert CognitoUserPoolAdmin(client).find_user_pool_id("sample") == "pool-2"


def test_admin_create_user_builds_attributes() -> None:
    client = MagicMock()
    client.admin_create_user.return_value = {"User": {"Username": "user@example.com"}}

    user = CognitoUserPoolAdmin(client).admin_create_user(
        "pool-1",
        "user@example.com",
        temporary_password="Password123",
        user_attributes={"email": "user@example.com", "email_verified": "true"},
    )

    assert user == {"Username": "user@example.com"}
    client.admin_create_user.assert_called_once_with(
        UserPoolId="pool-1",
        Username="user@example.com",
        TemporaryPassword="Password123",
        UserAttributes=[
            {"Name": "email", "Value": "user@example.com"},
            {"Name": "email_verified", "Value": "true"},
        ],
        MessageAction="SUPPRESS",
    )


def test_admin_create_user_if_missing_returns_existing_user() -> None:
    client = MagicMock()
    client.admin_create_user.side_effect = ClientError(
        {"Error": {"Code": "UsernameExistsException", "Message": "exists"}},
        "AdminCreateUser",
    )
    client.admin_get_user.return_value = {"Username": "user@example.com"}

    user, already_exists = CognitoUserPoolAdmin(client).admin_create_user_if_missing(
        "pool-1",
        "user@example.com",
    )

    assert user == {"Username": "user@example.com"}
    assert already_exists is True


def test_admin_create_user_wraps_client_errors() -> None:
    client = MagicMock()
    client.admin_create_user.side_effect = ClientError(
        {"Error": {"Code": "InvalidParameterException", "Message": "invalid"}},
        "AdminCreateUser",
    )

    with pytest.raises(AwsServiceError, match="Failed to create Cognito user"):
        CognitoUserPoolAdmin(client).admin_create_user("pool-1", "user@example.com")
