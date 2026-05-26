from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import Decimal
from typing import Any

from boto3.dynamodb.conditions import Attr, Key

from dynamodb_data_access.base_dynamo_dao import AbstractDynamoDbClient, BaseDynamoDao


@dataclass(frozen=True)
class SandboxRecord:
    pk: str
    sk: str
    message: str
    status: str
    run_id: str
    created_at: str
    updated_at: str
    attempt_count: int = 0

    @classmethod
    def from_item(cls, item: dict[str, Any]) -> SandboxRecord:
        payload = dict(item)
        payload["attempt_count"] = int(payload.get("attempt_count", 0))
        return cls(**payload)

    def to_item(self) -> dict[str, Any]:
        item = asdict(self)
        item["attempt_count"] = Decimal(str(self.attempt_count))
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

    def update_status(
        self,
        pk: str,
        sk: str,
        status: str,
        updated_at: str,
    ) -> SandboxRecord:
        item = self._update_raw(
            key={"pk": pk, "sk": sk},
            update_expression=(
                "SET #status = :status, updated_at = :updated_at "
                "ADD attempt_count :attempt_increment"
            ),
            expression_attribute_names={"#status": "status"},
            expression_attribute_values={
                ":status": status,
                ":updated_at": updated_at,
                ":attempt_increment": Decimal("1"),
            },
            return_values="ALL_NEW",
        )
        return SandboxRecord.from_item(item)

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
