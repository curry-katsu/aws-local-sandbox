from __future__ import annotations

import json
import os
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError

from dynamodb_data_access.dynamodb import DynamoDbClient
from dynamodb_data_access.sandbox_table_dao import DeviceType, SandboxRecord, SandboxTableDao

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
    if isinstance(value, Enum):
        return value.value
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
            device_type=DeviceType.IOS if index % 2 else DeviceType.ANDROID,
            run_id=run_id,
            created_at=created_at,
            updated_at=created_at,
            attempt_count=0,
        )
        for index in range(1, 4)
    ]


def build_single_record(run_id: str) -> SandboxRecord:
    created_at = utc_now()
    return SandboxRecord(
        pk=f"SINGLE#{run_id}",
        sk="ITEM#001",
        message="single put/update sample item",
        status="PENDING",
        device_type=DeviceType.IOS,
        run_id=run_id,
        created_at=created_at,
        updated_at=created_at,
        attempt_count=0,
    )


def run_single_item_sample(dao: SandboxTableDao, run_id: str) -> dict[str, Any]:
    record = build_single_record(run_id)

    dao.put(record)
    fetched_after_put = dao.get(record.pk, record.sk)

    updated_after_update = dao.update_item(
        pk=record.pk,
        sk=record.sk,
        set_values={
            "status": "SINGLE_DONE",
            "updated_at": utc_now(),
            "message": "single item updated through generic update_item",
        },
        add_values={"attempt_count": 1},
    )

    return {
        "record_key": {"pk": record.pk, "sk": record.sk},
        "put_item": fetched_after_put,
        "update_item": updated_after_update,
        "put_passed": fetched_after_put == record,
        "update_passed": updated_after_update.status == "SINGLE_DONE"
        and updated_after_update.attempt_count == 1,
    }


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
    single_item_sample = run_single_item_sample(dao, run_id)

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
    fetched_device_type_is_enum = isinstance(fetched.device_type, DeviceType) if fetched else False
    updated_device_type_is_enum = isinstance(updated.device_type, DeviceType)
    queried_device_types_are_enum = all(
        isinstance(record.device_type, DeviceType) for record in queried
    )

    if not settings.keep_items:
        for record in records:
            dao.delete(record.pk, record.sk)
        dao.delete(
            single_item_sample["record_key"]["pk"],
            single_item_sample["record_key"]["sk"],
        )

    return {
        "status": "ok",
        "run_id": run_id,
        "endpoint_url": settings.endpoint_url,
        "region": settings.region,
        "table_name": settings.table_name,
        "operations": {
            "single_item_sample": single_item_sample,
            "batch_put_count": len(records),
            "get_item": fetched,
            "update_item": updated,
            "query_count": len(queried),
            "scan_done_count": len(done_items),
            "enum_conversion": {
                "stored_value": first.device_type.value,
                "fetched_device_type": fetched.device_type.name if fetched else None,
                "fetched_device_type_value": fetched.device_type.value if fetched else None,
                "fetched_device_type_is_enum": fetched_device_type_is_enum,
                "updated_device_type_is_enum": updated_device_type_is_enum,
                "queried_device_types_are_enum": queried_device_types_are_enum,
                "passed": fetched_device_type_is_enum
                and updated_device_type_is_enum
                and queried_device_types_are_enum,
            },
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
