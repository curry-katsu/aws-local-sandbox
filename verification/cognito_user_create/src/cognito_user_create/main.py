from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

DEFAULT_ENDPOINT_URL = "http://localhost:4566"
DEFAULT_REGION = "us-east-1"
DEFAULT_USER_POOL_NAME = "aws-local-sandbox-user-pool"
DEFAULT_USERNAME = "sandbox-user@example.com"
DEFAULT_TEMPORARY_PASSWORD = "Sandbox123"


@dataclass(frozen=True)
class Settings:
    endpoint_url: str
    region: str
    access_key_id: str
    secret_access_key: str
    user_pool_id: str | None
    user_pool_name: str
    username: str
    email: str
    temporary_password: str
    permanent_password: str
    set_permanent_password: bool


def utc_now() -> datetime:
    return datetime.now(UTC)


def isoformat(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def env_bool(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    return raw_value.strip().lower() in {"1", "true", "yes", "y", "on"}


def load_settings() -> Settings:
    endpoint_url = os.getenv("AWS_ENDPOINT_URL", DEFAULT_ENDPOINT_URL).rstrip("/")
    username = os.getenv("COGNITO_USERNAME", DEFAULT_USERNAME)
    email = os.getenv("COGNITO_USER_EMAIL", username)
    temporary_password = os.getenv("COGNITO_TEMPORARY_PASSWORD", DEFAULT_TEMPORARY_PASSWORD)

    return Settings(
        endpoint_url=endpoint_url,
        region=os.getenv("AWS_DEFAULT_REGION", DEFAULT_REGION),
        access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
        secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
        user_pool_id=os.getenv("COGNITO_USER_POOL_ID"),
        user_pool_name=os.getenv("COGNITO_USER_POOL_NAME", DEFAULT_USER_POOL_NAME),
        username=username,
        email=email,
        temporary_password=temporary_password,
        permanent_password=os.getenv("COGNITO_PERMANENT_PASSWORD", temporary_password),
        set_permanent_password=env_bool("COGNITO_SET_PERMANENT_PASSWORD", False),
    )


def cognito_client(settings: Settings) -> Any:
    return boto3.client(
        "cognito-idp",
        endpoint_url=settings.endpoint_url,
        region_name=settings.region,
        aws_access_key_id=settings.access_key_id,
        aws_secret_access_key=settings.secret_access_key,
        config=Config(retries={"max_attempts": 3, "mode": "standard"}),
    )


def find_user_pool_id(cognito: Any, settings: Settings) -> str:
    if settings.user_pool_id:
        return settings.user_pool_id

    next_token = None

    while True:
        request: dict[str, Any] = {"MaxResults": 60}
        if next_token:
            request["NextToken"] = next_token

        response = cognito.list_user_pools(**request)

        for user_pool in response.get("UserPools", []):
            if user_pool.get("Name") == settings.user_pool_name:
                user_pool_id = user_pool.get("Id")
                if user_pool_id:
                    return user_pool_id

        next_token = response.get("NextToken")
        if not next_token:
            break

    raise ValueError(
        "Cognito User Pool was not found. "
        "Run make infra-apply or set COGNITO_USER_POOL_ID explicitly."
    )


def create_user(cognito: Any, settings: Settings, user_pool_id: str) -> tuple[dict[str, Any], bool]:
    try:
        response = cognito.admin_create_user(
            UserPoolId=user_pool_id,
            Username=settings.username,
            UserAttributes=[
                {"Name": "email", "Value": settings.email},
                {"Name": "email_verified", "Value": "true"},
            ],
            TemporaryPassword=settings.temporary_password,
            MessageAction="SUPPRESS",
        )
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        if error_code == "UsernameExistsException":
            return get_user(cognito, settings, user_pool_id), True
        raise

    return response["User"], False


def set_permanent_password(cognito: Any, settings: Settings, user_pool_id: str) -> None:
    cognito.admin_set_user_password(
        UserPoolId=user_pool_id,
        Username=settings.username,
        Password=settings.permanent_password,
        Permanent=True,
    )


def get_user(cognito: Any, settings: Settings, user_pool_id: str) -> dict[str, Any]:
    return cognito.admin_get_user(
        UserPoolId=user_pool_id,
        Username=settings.username,
    )


def simplify_user(user: dict[str, Any]) -> dict[str, Any]:
    attributes = {
        attribute["Name"]: attribute.get("Value", "")
        for attribute in user.get("UserAttributes", [])
        if "Name" in attribute
    }

    return {
        "username": user.get("Username"),
        "enabled": user.get("Enabled"),
        "status": user.get("UserStatus"),
        "attributes": attributes,
    }


def run() -> dict[str, Any]:
    settings = load_settings()
    cognito = cognito_client(settings)
    started_at = utc_now()
    started = time.perf_counter()

    try:
        user_pool_id = find_user_pool_id(cognito, settings)
        created_user, user_already_exists = create_user(cognito, settings, user_pool_id)

        if settings.set_permanent_password:
            set_permanent_password(cognito, settings, user_pool_id)

        verified_user = get_user(cognito, settings, user_pool_id)
    except (BotoCoreError, ClientError, ValueError, KeyError) as exc:
        finished_at = utc_now()
        return {
            "status": "failed",
            "started_at": isoformat(started_at),
            "finished_at": isoformat(finished_at),
            "duration_ms": round((time.perf_counter() - started) * 1000, 3),
            "endpoint_url": settings.endpoint_url,
            "region": settings.region,
            "user_pool_name": settings.user_pool_name,
            "username": settings.username,
            "error": str(exc),
        }

    finished_at = utc_now()
    return {
        "status": "success",
        "started_at": isoformat(started_at),
        "finished_at": isoformat(finished_at),
        "duration_ms": round((time.perf_counter() - started) * 1000, 3),
        "endpoint_url": settings.endpoint_url,
        "region": settings.region,
        "user_pool_id": user_pool_id,
        "user_pool_name": settings.user_pool_name,
        "created_user": simplify_user(created_user),
        "verified_user": simplify_user(verified_user),
        "user_already_exists": user_already_exists,
        "permanent_password_set": settings.set_permanent_password,
    }


def main() -> None:
    result = run()
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))

    if result["status"] != "success":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
