from dataclasses import dataclass


@dataclass(frozen=True)
class AwsClientConfig:
    region_name: str | None = None
    endpoint_url: str | None = None
    profile_name: str | None = None
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_session_token: str | None = None
