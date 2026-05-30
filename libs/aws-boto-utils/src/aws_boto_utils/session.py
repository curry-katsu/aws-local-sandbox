import boto3

from aws_boto_utils.config import AwsClientConfig


def create_session(config: AwsClientConfig | None = None) -> boto3.Session:
    client_config = config or AwsClientConfig()

    return boto3.Session(
        profile_name=client_config.profile_name,
        region_name=client_config.region_name,
        aws_access_key_id=client_config.aws_access_key_id,
        aws_secret_access_key=client_config.aws_secret_access_key,
        aws_session_token=client_config.aws_session_token,
    )
