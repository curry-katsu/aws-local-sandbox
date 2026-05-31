from typing import Any

import boto3
from botocore.client import BaseClient

from aws_boto_utils.config import AwsClientConfig
from aws_boto_utils.session import create_session


def create_client(
    service_name: str, config: AwsClientConfig | None = None, **kwargs: Any
) -> BaseClient:
    client_config = config or AwsClientConfig()
    session = create_session(client_config)
    endpoint_url = kwargs.pop("endpoint_url", client_config.endpoint_url)

    return session.client(service_name, endpoint_url=endpoint_url, **kwargs)


def create_resource(
    service_name: str, config: AwsClientConfig | None = None, **kwargs: Any
) -> boto3.resources.base.ServiceResource:
    client_config = config or AwsClientConfig()
    session = create_session(client_config)
    endpoint_url = kwargs.pop("endpoint_url", client_config.endpoint_url)

    return session.resource(service_name, endpoint_url=endpoint_url, **kwargs)
