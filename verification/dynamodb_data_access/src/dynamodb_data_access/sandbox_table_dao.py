from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import Decimal
from enum import Enum
from typing import Any

from boto3.dynamodb.conditions import Attr, Key

from dynamodb_data_access.base_dynamo_dao import AbstractDynamoDbClient, BaseDynamoDao


class DeviceType(Enum):
    IOS = "ios"
    ANDROID = "android"


@dataclass(frozen=True)
class SandboxRecord:
    pk: str
    sk: str
    message: str
    status: str
    device_type: DeviceType
    run_id: str
    created_at: str
    updated_at: str
    attempt_count: int = 0

    @classmethod
    def from_item(cls, item: dict[str, Any]) -> SandboxRecord:
        payload = dict(item)
        payload["attempt_count"] = int(payload.get("attempt_count", 0))
        payload["device_type"] = DeviceType(payload["device_type"])
        return cls(**payload)

    def to_item(self) -> dict[str, Any]:
        item = asdict(self)
        item["attempt_count"] = Decimal(str(self.attempt_count))
        item["device_type"] = self.device_type.value
        return item


class SandboxTableDao(BaseDynamoDao[SandboxRecord]):
    def __init__(self, client: AbstractDynamoDbClient, table_name: str) -> None:
        super().__init__(client)
        self.table_name = table_name

    def put(self, record: SandboxRecord) -> None:
        self._put_raw(record.to_item())

    def get(self, pk: str, sk: str, consistent_read: bool = True) -> SandboxRecord | None:
        item = self._get_raw(
            key={"pk": pk, "sk": sk},
            consistent_read=consistent_read,
        )
        return SandboxRecord.from_item(item) if item else None

    def update_item(
        self,
        pk: str,
        sk: str,
        set_values: dict[str, Any] | None = None,
        add_values: dict[str, Any] | None = None,
        remove_fields: list[str] | None = None,
        condition_expression: str | None = None,
    ) -> SandboxRecord:
        item = self._update_attributes_raw(
            key={"pk": pk, "sk": sk},
            set_values=self._serialize_values(set_values),
            add_values=self._serialize_values(add_values),
            remove_fields=remove_fields,
            condition_expression=condition_expression,
            return_values="ALL_NEW",
        )
        return SandboxRecord.from_item(item)

    def update_status(
        self,
        pk: str,
        sk: str,
        status: str,
        updated_at: str,
    ) -> SandboxRecord:
        return self.update_item(
            pk=pk,
            sk=sk,
            set_values={
                "status": status,
                "updated_at": updated_at,
            },
            add_values={"attempt_count": 1},
        )

    def list_by_pk(self, pk: str, limit: int | None = None) -> list[SandboxRecord]:
        items = self._query_raw(
            key_condition_expression=Key("pk").eq(pk),
            limit=limit,
            scan_index_forward=True,
            consistent_read=True,
        )
        return [SandboxRecord.from_item(item) for item in items]

    def scan_by_status(self, status: str, limit: int | None = None) -> list[SandboxRecord]:
        items = self._scan_raw(
            filter_expression=Attr("status").eq(status),
            limit=limit,
        )
        return [SandboxRecord.from_item(item) for item in items]

    def batch_put(self, records: list[SandboxRecord]) -> None:
        self._batch_put_raw([record.to_item() for record in records])

    def delete(self, pk: str, sk: str) -> None:
        self._delete_raw(key={"pk": pk, "sk": sk})

    def _serialize_values(self, values: dict[str, Any] | None) -> dict[str, Any] | None:
        if values is None:
            return None

        serialized: dict[str, Any] = {}
        for key, value in values.items():
            if isinstance(value, Enum):
                serialized[key] = value.value
            elif isinstance(value, int):
                serialized[key] = Decimal(str(value))
            else:
                serialized[key] = value
        return serialized
