from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import boto3
from aws_boto_utils import AwsClientConfig
from aws_boto_utils.services import S3Client
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

DEFAULT_ENDPOINT_URL = "http://localhost:4566"
DEFAULT_REGION = "us-east-1"
DEFAULT_QUEUE_NAME = "aws-local-sandbox-queue"
DEFAULT_TABLE_NAME = "aws-local-sandbox-table"
DEFAULT_BUCKET_NAME = "aws-local-sandbox-bucket"
DEFAULT_ACCOUNT_ID = "000000000000"


@dataclass(frozen=True)
class Settings:
    endpoint_url: str
    region: str
    access_key_id: str
    secret_access_key: str
    queue_name: str
    queue_url: str
    table_name: str
    bucket_name: str
    max_messages: int
    wait_time_seconds: int
    log_prefix: str
    log_dir: Path


def utc_now() -> datetime:
    return datetime.now(UTC)


def isoformat(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def env_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if not raw_value:
        return default

    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer: {raw_value}") from exc

    if value < 0:
        raise ValueError(f"{name} must be zero or greater: {raw_value}")

    return value


def load_settings() -> Settings:
    endpoint_url = os.getenv("AWS_ENDPOINT_URL", DEFAULT_ENDPOINT_URL).rstrip("/")
    region = os.getenv("AWS_DEFAULT_REGION", DEFAULT_REGION)
    queue_name = os.getenv("SQS_QUEUE_NAME", DEFAULT_QUEUE_NAME)
    queue_url = os.getenv(
        "SQS_QUEUE_URL",
        f"{endpoint_url}/{DEFAULT_ACCOUNT_ID}/{queue_name}",
    )

    return Settings(
        endpoint_url=endpoint_url,
        region=region,
        access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
        secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
        queue_name=queue_name,
        queue_url=queue_url,
        table_name=os.getenv("DYNAMODB_TABLE_NAME", DEFAULT_TABLE_NAME),
        bucket_name=os.getenv("S3_BUCKET_NAME", DEFAULT_BUCKET_NAME),
        max_messages=min(env_int("MAX_MESSAGES", 10), 10),
        wait_time_seconds=min(env_int("WAIT_TIME_SECONDS", 2), 20),
        log_prefix=os.getenv("LOG_PREFIX", "verification-logs").strip("/"),
        log_dir=Path(os.getenv("LOG_DIR", "logs")),
    )


def boto3_client(service_name: str, settings: Settings) -> Any:
    return boto3.client(
        service_name,
        endpoint_url=settings.endpoint_url,
        region_name=settings.region,
        aws_access_key_id=settings.access_key_id,
        aws_secret_access_key=settings.secret_access_key,
        config=Config(
            retries={"max_attempts": 3, "mode": "standard"},
            s3={"addressing_style": "path"},
        ),
    )


def aws_config(settings: Settings) -> AwsClientConfig:
    return AwsClientConfig(
        endpoint_url=settings.endpoint_url,
        region_name=settings.region,
        aws_access_key_id=settings.access_key_id,
        aws_secret_access_key=settings.secret_access_key,
    )


def parse_message_body(body: str) -> Any:
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return body


def dynamodb_item(message: dict[str, Any], processed_at: str, run_id: str) -> dict[str, Any]:
    message_id = message.get("MessageId") or str(uuid.uuid4())
    body = message.get("Body", "")

    return {
        "pk": {"S": f"MESSAGE#{message_id}"},
        "sk": {"S": f"PROCESSED#{processed_at}"},
        "message_id": {"S": message_id},
        "run_id": {"S": run_id},
        "processed_at": {"S": processed_at},
        "body": {"S": body},
        "body_json": {"S": json.dumps(parse_message_body(body), ensure_ascii=False)},
        "source": {"S": "sqs-to-dynamodb-s3-log"},
    }


def receive_messages(sqs: Any, settings: Settings) -> list[dict[str, Any]]:
    response = sqs.receive_message(
        QueueUrl=settings.queue_url,
        MaxNumberOfMessages=settings.max_messages,
        WaitTimeSeconds=settings.wait_time_seconds,
        MessageAttributeNames=["All"],
        AttributeNames=["All"],
    )
    return response.get("Messages", [])


def write_messages_to_dynamodb(
    dynamodb: Any,
    sqs: Any,
    settings: Settings,
    messages: list[dict[str, Any]],
    run_id: str,
) -> list[dict[str, Any]]:
    results = []

    for message in messages:
        processed_at = isoformat(utc_now())
        started = time.perf_counter()
        message_id = message.get("MessageId", "")

        dynamodb.put_item(
            TableName=settings.table_name,
            Item=dynamodb_item(message, processed_at, run_id),
        )

        sqs.delete_message(
            QueueUrl=settings.queue_url,
            ReceiptHandle=message["ReceiptHandle"],
        )

        results.append(
            {
                "message_id": message_id,
                "dynamodb_pk": f"MESSAGE#{message_id}",
                "dynamodb_sk": f"PROCESSED#{processed_at}",
                "body_size_bytes": len(message.get("Body", "").encode("utf-8")),
                "processing_duration_ms": round((time.perf_counter() - started) * 1000, 3),
                "deleted_from_sqs": True,
            }
        )

    return results


def write_log_file(settings: Settings, payload: dict[str, Any], run_id: str) -> Path:
    settings.log_dir.mkdir(parents=True, exist_ok=True)
    log_path = settings.log_dir / f"{run_id}.json"
    log_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return log_path


def build_s3_log_key(settings: Settings, run_id: str) -> str:
    date_prefix = utc_now().strftime("%Y/%m/%d")
    return f"{settings.log_prefix}/{date_prefix}/{run_id}.json"


def upload_log_to_s3(s3: S3Client, settings: Settings, log_path: Path, s3_key: str) -> None:
    s3.upload_file(
        filename=log_path,
        bucket=settings.bucket_name,
        key=s3_key,
        extra_args={"ContentType": "application/json"},
    )


def build_log_payload(
    settings: Settings,
    run_id: str,
    started_at: datetime,
    finished_at: datetime,
    message_results: list[dict[str, Any]],
    status: str,
    error: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "run_id": run_id,
        "status": status,
        "started_at": isoformat(started_at),
        "finished_at": isoformat(finished_at),
        "duration_ms": round((finished_at - started_at).total_seconds() * 1000, 3),
        "resource_names": {
            "sqs_queue_name": settings.queue_name,
            "sqs_queue_url": settings.queue_url,
            "dynamodb_table_name": settings.table_name,
            "s3_bucket_name": settings.bucket_name,
        },
        "message_count": len(message_results),
        "messages": message_results,
    }

    if error:
        payload["error"] = error

    return payload


def run() -> dict[str, Any]:
    settings = load_settings()
    run_id = f"{utc_now().strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    s3_key = build_s3_log_key(settings, run_id)
    started_at = utc_now()

    sqs = boto3_client("sqs", settings)
    dynamodb = boto3_client("dynamodb", settings)
    s3 = S3Client.from_config(aws_config(settings))

    try:
        messages = receive_messages(sqs, settings)
        message_results = write_messages_to_dynamodb(dynamodb, sqs, settings, messages, run_id)
        finished_at = utc_now()
        payload = build_log_payload(
            settings=settings,
            run_id=run_id,
            started_at=started_at,
            finished_at=finished_at,
            message_results=message_results,
            status="success",
        )
        payload["s3_log_key"] = s3_key
    except (BotoCoreError, ClientError, KeyError, ValueError) as exc:
        finished_at = utc_now()
        payload = build_log_payload(
            settings=settings,
            run_id=run_id,
            started_at=started_at,
            finished_at=finished_at,
            message_results=[],
            status="failed",
            error=str(exc),
        )
        log_path = write_log_file(settings, payload, run_id)
        payload["local_log_path"] = str(log_path)
        raise RuntimeError(json.dumps(payload, ensure_ascii=False)) from exc

    log_path = write_log_file(settings, payload, run_id)
    upload_log_to_s3(s3, settings, log_path, s3_key)

    payload["local_log_path"] = str(log_path)
    return payload


def main() -> None:
    result = run()
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
