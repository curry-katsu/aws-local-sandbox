from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from dynamodb_data_access.dynamodb import DynamoDbClient
from dynamodb_data_access.index_ttl_table_dao import (
    GSI_NAME,
    LSI_NAME,
    SPARSE_GSI_NAME,
    IndexTtlRecord,
    IndexTtlTableDao,
)

DEFAULT_ENDPOINT_URL = "http://localhost:4566"
DEFAULT_REGION = "us-east-1"
DEFAULT_TABLE_NAME = "aws-local-sandbox-index-ttl-table"


@dataclass(frozen=True)
class Settings:
    endpoint_url: str
    region: str
    access_key_id: str
    secret_access_key: str
    table_name: str
    keep_items: bool
    ttl_wait_seconds: int


def load_settings() -> Settings:
    return Settings(
        endpoint_url=os.getenv("AWS_ENDPOINT_URL", DEFAULT_ENDPOINT_URL).rstrip("/"),
        region=os.getenv("AWS_DEFAULT_REGION", DEFAULT_REGION),
        access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
        secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
        table_name=os.getenv("DYNAMODB_INDEX_TTL_TABLE_NAME", DEFAULT_TABLE_NAME),
        keep_items=os.getenv("DYNAMODB_KEEP_ITEMS", "false").lower() == "true",
        ttl_wait_seconds=max(int(os.getenv("DYNAMODB_TTL_WAIT_SECONDS", "10")), 0),
    )


def epoch_now() -> int:
    return int(datetime.now(UTC).timestamp())


def iso_now_compact() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def to_jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    if isinstance(value, IndexTtlRecord):
        return asdict(value)
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: to_jsonable(item) for key, item in value.items()}
    return value


def boto3_client(settings: Settings) -> Any:
    return boto3.client(
        "dynamodb",
        endpoint_url=settings.endpoint_url,
        region_name=settings.region,
        aws_access_key_id=settings.access_key_id,
        aws_secret_access_key=settings.secret_access_key,
        config=Config(retries={"max_attempts": 3, "mode": "standard"}),
    )


def build_records(run_id: str, now_epoch: int) -> list[IndexTtlRecord]:
    pk = f"VERIFY#{run_id}"
    stamp = iso_now_compact()
    return [
        IndexTtlRecord(
            pk=pk,
            sk="ORDER#001",
            lsi_sk=f"ACTIVE#{stamp}#001",
            gsi_pk="CUSTOMER#alice",
            gsi_sk=f"ORDER#{stamp}#001",
            category="book",
            status="REVIEW_REQUIRED",
            message="lsi and sparse gsi target",
            run_id=run_id,
            ttl_epoch=now_epoch + 3600,
            sparse_gsi_pk="STATUS#REVIEW_REQUIRED",
            sparse_gsi_sk=f"ORDER#{stamp}#001",
        ),
        IndexTtlRecord(
            pk=pk,
            sk="ORDER#002",
            lsi_sk=f"ACTIVE#{stamp}#002",
            gsi_pk="CUSTOMER#alice",
            gsi_sk=f"ORDER#{stamp}#002",
            category="music",
            status="READY",
            message="lsi and gsi target without sparse attributes",
            run_id=run_id,
            ttl_epoch=now_epoch + 3600,
        ),
        IndexTtlRecord(
            pk=pk,
            sk="ORDER#003",
            lsi_sk=f"ACTIVE#{stamp}#003",
            gsi_pk="CUSTOMER#bob",
            gsi_sk=f"ORDER#{stamp}#003",
            category="book",
            status="REVIEW_REQUIRED",
            message="sparse gsi target for low-cardinality status",
            run_id=run_id,
            ttl_epoch=now_epoch + 3600,
            sparse_gsi_pk="STATUS#REVIEW_REQUIRED",
            sparse_gsi_sk=f"ORDER#{stamp}#003",
        ),
        IndexTtlRecord(
            pk=pk,
            sk="ORDER#TTL-SOON",
            lsi_sk=f"TTL#{stamp}#SOON",
            gsi_pk="CUSTOMER#ttl",
            gsi_sk=f"ORDER#{stamp}#TTL-SOON",
            category="ttl",
            status="EXPIRES_SOON",
            message="near-future ttl target",
            run_id=run_id,
            ttl_epoch=now_epoch + 3,
        ),
        IndexTtlRecord(
            pk=pk,
            sk="ORDER#EXPIRED",
            lsi_sk=f"TTL#{stamp}#EXPIRED",
            gsi_pk="CUSTOMER#ttl",
            gsi_sk=f"ORDER#{stamp}#EXPIRED",
            category="ttl",
            status="EXPIRED",
            message="expired ttl target",
            run_id=run_id,
            ttl_epoch=now_epoch - 60,
        ),
    ]


def ttl_description(client: Any, table_name: str) -> dict[str, Any]:
    response = client.describe_time_to_live(TableName=table_name)
    return response.get("TimeToLiveDescription", {})


def run_verification(settings: Settings) -> dict[str, Any]:
    client = DynamoDbClient(
        endpoint_url=settings.endpoint_url,
        region_name=settings.region,
        aws_access_key_id=settings.access_key_id,
        aws_secret_access_key=settings.secret_access_key,
    )
    low_level_client = boto3_client(settings)
    dao = IndexTtlTableDao(client=client, table_name=settings.table_name)
    run_id = str(uuid.uuid4())
    now_epoch = epoch_now()
    records = build_records(run_id, now_epoch)
    pk = records[0].pk

    dao.batch_put(records)

    lsi_items = dao.query_lsi(pk=pk, lsi_sk_prefix="ACTIVE#")
    gsi_items = dao.query_gsi(gsi_pk="CUSTOMER#alice", gsi_sk_prefix="ORDER#")
    sparse_items = dao.query_sparse_gsi(sparse_gsi_pk="STATUS#REVIEW_REQUIRED")
    expired_items = dao.scan_expired(now_epoch=epoch_now())
    ttl_before_wait = dao.get(pk=pk, sk="ORDER#EXPIRED")
    ttl_soon_before_wait = dao.get(pk=pk, sk="ORDER#TTL-SOON")

    if settings.ttl_wait_seconds > 0:
        time.sleep(settings.ttl_wait_seconds)

    ttl_after_wait = dao.get(pk=pk, sk="ORDER#EXPIRED")
    ttl_soon_after_wait = dao.get(pk=pk, sk="ORDER#TTL-SOON")
    ttl_deleted_immediately = ttl_before_wait is None
    ttl_soon_auto_deleted = ttl_soon_before_wait is not None and ttl_soon_after_wait is None
    ttl_auto_deleted = ttl_deleted_immediately or ttl_soon_auto_deleted

    if not settings.keep_items:
        for record in records:
            if dao.get(record.pk, record.sk, consistent_read=True) is not None:
                dao.delete(record.pk, record.sk)

    return {
        "status": "ok",
        "run_id": run_id,
        "endpoint_url": settings.endpoint_url,
        "region": settings.region,
        "table_name": settings.table_name,
        "index_names": {
            "lsi": LSI_NAME,
            "gsi": GSI_NAME,
            "sparse_gsi": SPARSE_GSI_NAME,
        },
        "ttl": {
            "description": ttl_description(low_level_client, settings.table_name),
            "expired_item_detected_by_scan": len(expired_items) >= 1,
            "expired_item_present_before_wait": ttl_before_wait is not None,
            "ttl_wait_seconds": settings.ttl_wait_seconds,
            "expired_item_present_after_wait": ttl_after_wait is not None,
            "expired_item_deleted_immediately": ttl_deleted_immediately,
            "near_future_item_present_before_wait": ttl_soon_before_wait is not None,
            "near_future_item_present_after_wait": ttl_soon_after_wait is not None,
            "near_future_item_auto_deleted_within_wait": ttl_soon_auto_deleted,
            "auto_deleted_within_wait": ttl_auto_deleted,
        },
        "checks": {
            "lsi_query_count": len(lsi_items),
            "lsi_query_passed": len(lsi_items) == 3,
            "gsi_query_count": len(gsi_items),
            "gsi_query_passed": len(gsi_items) == 2,
            "sparse_gsi_query_count": len(sparse_items),
            "sparse_gsi_query_passed": len(sparse_items) == 2
            and all(item.sparse_gsi_pk == "STATUS#REVIEW_REQUIRED" for item in sparse_items),
            "ttl_expiration_detection_passed": len(expired_items) >= 1 or ttl_deleted_immediately,
            "ttl_auto_delete_passed": ttl_auto_deleted,
            "deleted_after_run": not settings.keep_items,
        },
        "samples": {
            "lsi_items": lsi_items,
            "gsi_items": gsi_items,
            "sparse_gsi_items": sparse_items,
            "expired_items": expired_items,
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
