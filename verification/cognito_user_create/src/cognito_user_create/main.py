from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from aws_boto_utils import AwsClientConfig
from aws_boto_utils.exceptions import AwsServiceError
from aws_boto_utils.services import CognitoUserPoolAdmin

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


def aws_config(settings: Settings) -> AwsClientConfig:
    return AwsClientConfig(
        endpoint_url=settings.endpoint_url,
        region_name=settings.region,
        aws_access_key_id=settings.access_key_id,
        aws_secret_access_key=settings.secret_access_key,
    )


def find_user_pool_id(cognito: CognitoUserPoolAdmin, settings: Settings) -> str:
    if settings.user_pool_id:
        return settings.user_pool_id

    try:
        return cognito.find_user_pool_id(settings.user_pool_name)
    except AwsServiceError as error:
        raise ValueError(
            "Cognito User Pool was not found. "
            "Run make infra-apply or set COGNITO_USER_POOL_ID explicitly."
        ) from error


def create_user(
    cognito: CognitoUserPoolAdmin, settings: Settings, user_pool_id: str
) -> tuple[dict[str, Any], bool]:
    return cognito.admin_create_user_if_missing(
        user_pool_id=user_pool_id,
        username=settings.username,
        user_attributes={
            "email": settings.email,
            "email_verified": "true",
        },
        temporary_password=settings.temporary_password,
    )


def set_permanent_password(
    cognito: CognitoUserPoolAdmin, settings: Settings, user_pool_id: str
) -> None:
    cognito.admin_set_user_password(
        user_pool_id=user_pool_id,
        username=settings.username,
        password=settings.permanent_password,
        permanent=True,
    )


def get_user(
    cognito: CognitoUserPoolAdmin, settings: Settings, user_pool_id: str
) -> dict[str, Any]:
    return cognito.admin_get_user(user_pool_id=user_pool_id, username=settings.username)


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
    cognito = CognitoUserPoolAdmin.from_config(aws_config(settings))
    started_at = utc_now()
    started = time.perf_counter()

    try:
        user_pool_id = find_user_pool_id(cognito, settings)
        created_user, user_already_exists = create_user(cognito, settings, user_pool_id)

        if settings.set_permanent_password:
            set_permanent_password(cognito, settings, user_pool_id)

        verified_user = get_user(cognito, settings, user_pool_id)
    except (AwsServiceError, ValueError, KeyError) as exc:
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
