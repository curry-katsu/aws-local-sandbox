from typing import Any

from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from aws_boto_utils.clients import create_client
from aws_boto_utils.config import AwsClientConfig
from aws_boto_utils.exceptions import AwsServiceError


class CognitoUserPoolAdmin:
    def __init__(self, client: Any) -> None:
        self._client = client

    @classmethod
    def from_config(cls, config: AwsClientConfig | None = None) -> "CognitoUserPoolAdmin":
        botocore_config = Config(retries={"max_attempts": 3, "mode": "standard"})
        return cls(create_client("cognito-idp", config, config=botocore_config))

    def list_user_pools(self, *, max_results: int = 60) -> list[dict[str, Any]]:
        user_pools: list[dict[str, Any]] = []
        next_token = None

        try:
            while True:
                request: dict[str, Any] = {"MaxResults": max_results}
                if next_token:
                    request["NextToken"] = next_token

                response = self._client.list_user_pools(**request)
                user_pools.extend(response.get("UserPools", []))

                next_token = response.get("NextToken")
                if not next_token:
                    return user_pools
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError("Failed to list Cognito user pools") from error

    def find_user_pool_id(self, user_pool_name: str) -> str:
        for user_pool in self.list_user_pools():
            if user_pool.get("Name") == user_pool_name:
                user_pool_id = user_pool.get("Id")
                if user_pool_id:
                    return user_pool_id

        raise AwsServiceError(f"Cognito user pool was not found: {user_pool_name}")

    def admin_create_user(
        self,
        user_pool_id: str,
        username: str,
        *,
        temporary_password: str | None = None,
        user_attributes: dict[str, str] | None = None,
        message_action: str | None = "SUPPRESS",
    ) -> dict[str, Any]:
        request: dict[str, Any] = {
            "UserPoolId": user_pool_id,
            "Username": username,
        }
        if temporary_password:
            request["TemporaryPassword"] = temporary_password
        if user_attributes:
            request["UserAttributes"] = [
                {"Name": name, "Value": value} for name, value in user_attributes.items()
            ]
        if message_action:
            request["MessageAction"] = message_action

        try:
            response = self._client.admin_create_user(**request)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to create Cognito user: {username}") from error

        user = response.get("User")
        if not isinstance(user, dict):
            raise AwsServiceError(f"AdminCreateUser did not return User: {username}")

        return user

    def admin_create_user_if_missing(
        self,
        user_pool_id: str,
        username: str,
        *,
        temporary_password: str | None = None,
        user_attributes: dict[str, str] | None = None,
        message_action: str | None = "SUPPRESS",
    ) -> tuple[dict[str, Any], bool]:
        try:
            user = self.admin_create_user(
                user_pool_id=user_pool_id,
                username=username,
                temporary_password=temporary_password,
                user_attributes=user_attributes,
                message_action=message_action,
            )
        except AwsServiceError as error:
            if _is_client_error_code(error.__cause__, "UsernameExistsException"):
                return self.admin_get_user(user_pool_id, username), True
            raise

        return user, False

    def admin_get_user(self, user_pool_id: str, username: str) -> dict[str, Any]:
        try:
            return self._client.admin_get_user(UserPoolId=user_pool_id, Username=username)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to get Cognito user: {username}") from error

    def admin_set_user_password(
        self,
        user_pool_id: str,
        username: str,
        password: str,
        *,
        permanent: bool = True,
    ) -> None:
        try:
            self._client.admin_set_user_password(
                UserPoolId=user_pool_id,
                Username=username,
                Password=password,
                Permanent=permanent,
            )
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to set Cognito user password: {username}") from error


def _is_client_error_code(error: BaseException | None, code: str) -> bool:
    if not isinstance(error, ClientError):
        return False

    return error.response.get("Error", {}).get("Code") == code
