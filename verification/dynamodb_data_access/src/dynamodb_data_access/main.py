from __future__ import annotations

import json
import os
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError

from dynamodb_data_access.dynamodb import DynamoDbClient
from dynamodb_data_access.sandbox_table_dao import SandboxRecord, SandboxTableDao

DEFAULT_ENDPOINT_URL = "http://localhost:4566"
DEFAULT_REGION = "us-east-1"
DEFAULT_TABLE_NAME = "aws-local-sandbox-table"


@dataclass(frozen=True)
class Settings:
    endpoint_url: str
    region: str
    access_key_id: str
    secret_access_key: str
    table_name: str
    keep_items: bool


def load_settings() -> Settings:
    return Settings(
        endpoint_url=os.getenv("AWS_ENDPOINT_URL", DEFAULT_ENDPOINT_URL).rstrip("/"),
        region=os.getenv("AWS_DEFAULT_REGION", DEFAULT_REGION),
        access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
        secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
        table_name=os.getenv("DYNAMODB_TABLE_NAME", DEFAULT_TABLE_NAME),
        keep_items=os.getenv("DYNAMODB_KEEP_ITEMS", "false").lower() == "true",
    )


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def to_jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    if isinstance(value, SandboxRecord):
        return asdict(value)
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: to_jsonable(item) for key, item in value.items()}
    return value


def build_records(run_id: str) -> list[SandboxRecord]:
    created_at = utc_now()
    return [
        SandboxRecord(
            pk=f"VERIFY#{run_id}",
            sk=f"ITEM#{index:02d}",
            message=f"dynamodb verification item {index}",
            status="PENDING",
            run_id=run_id,
            created_at=created_at,
            updated_at=created_at,
            attempt_count=0,
        )
        for index in range(1, 4)
    ]


def run_verification(settings: Settings) -> dict[str, Any]:
    client = DynamoDbClient(
        endpoint_url=settings.endpoint_url,
        region_name=settings.region,
        aws_access_key_id=settings.access_key_id,
        aws_secret_access_key=settings.secret_access_key,
    )
    dao = SandboxTableDao(client=client, table_name=settings.table_name)
    run_id = str(uuid.uuid4())
    records = build_records(run_id)

    dao.batch_put(records)

    first = records[0]
    fetched = dao.get(first.pk, first.sk)
    updated = dao.update_status(
        pk=first.pk,
        sk=first.sk,
        status="DONE",
        updated_at=utc_now(),
    )
    queried = dao.list_by_pk(first.pk)
    done_items = dao.scan_by_status("DONE", limit=25)

    if not settings.keep_items:
        for record in records:
            dao.delete(record.pk, record.sk)

    return {
        "status": "ok",
        "run_id": run_id,
        "endpoint_url": settings.endpoint_url,
        "region": settings.region,
        "table_name": settings.table_name,
        "operations": {
            "batch_put_count": len(records),
            "get_item": fetched,
            "update_item": updated,
            "query_count": len(queried),
            "scan_done_count": len(done_items),
            "deleted_after_run": not settings.keep_items,
        },
    }


def main() -> None:
    settings = load_settings()
    try:
        result = run_verification(settings)
    except (BotoCoreError, ClientError) as exc:
        payload = {
            "status": "error",
            "error": str(exc),
            "endpoint_url": settings.endpoint_url,
            "region": settings.region,
            "table_name": settings.table_name,
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2, default=to_jsonable))
        raise SystemExit(1) from exc

    print(json.dumps(result, ensure_ascii=False, indent=2, default=to_jsonable))


if __name__ == "__main__":
    main()
