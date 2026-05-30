class AwsBotoUtilsError(Exception):
    """Base error for aws-boto-utils."""


class AwsServiceError(AwsBotoUtilsError):
    """Raised when a wrapped AWS service call fails."""


class SecretJsonDecodeError(AwsBotoUtilsError):
    """Raised when a secret value cannot be decoded as JSON."""
