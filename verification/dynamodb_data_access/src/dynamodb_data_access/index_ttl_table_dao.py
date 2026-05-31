from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import Decimal
from typing import Any

from aws_boto_utils.services import AbstractDynamoDbClient, BaseDynamoDao
from boto3.dynamodb.conditions import Attr, Key

LSI_NAME = "lsi-by-lsi-sk"
GSI_NAME = "gsi-by-gsi-pk-sk"
SPARSE_GSI_NAME = "gsi-sparse-by-status"


@dataclass(frozen=True)
class IndexTtlRecord:
    pk: str
    sk: str
    lsi_sk: str
    gsi_pk: str
    gsi_sk: str
    category: str
    status: str
    message: str
    run_id: str
    ttl_epoch: int
    sparse_gsi_pk: str | None = None
    sparse_gsi_sk: str | None = None

    @classmethod
    def from_item(cls, item: dict[str, Any]) -> IndexTtlRecord:
        payload = dict(item)
        payload["ttl_epoch"] = int(payload["ttl_epoch"])
        return cls(**payload)

    def to_item(self) -> dict[str, Any]:
        item = {key: value for key, value in asdict(self).items() if value is not None}
        item["ttl_epoch"] = Decimal(str(self.ttl_epoch))
        return item


class IndexTtlTableDao(BaseDynamoDao[IndexTtlRecord]):
    def __init__(self, client: AbstractDynamoDbClient, table_name: str) -> None:
        super().__init__(client)
        self.table_name = table_name

    def batch_put(self, records: list[IndexTtlRecord]) -> None:
        self._batch_put_raw([record.to_item() for record in records])

    def get(self, pk: str, sk: str, consistent_read: bool = True) -> IndexTtlRecord | None:
        item = self._get_raw(
            key={"pk": pk, "sk": sk},
            consistent_read=consistent_read,
        )
        return IndexTtlRecord.from_item(item) if item else None

    def query_lsi(self, pk: str, lsi_sk_prefix: str) -> list[IndexTtlRecord]:
        items = self._query_raw(
            key_condition_expression=Key("pk").eq(pk) & Key("lsi_sk").begins_with(lsi_sk_prefix),
            index_name=LSI_NAME,
            scan_index_forward=True,
            consistent_read=True,
        )
        return [IndexTtlRecord.from_item(item) for item in items]

    def query_gsi(self, gsi_pk: str, gsi_sk_prefix: str) -> list[IndexTtlRecord]:
        items = self._query_raw(
            key_condition_expression=Key("gsi_pk").eq(gsi_pk)
            & Key("gsi_sk").begins_with(gsi_sk_prefix),
            index_name=GSI_NAME,
            scan_index_forward=True,
        )
        return [IndexTtlRecord.from_item(item) for item in items]

    def query_sparse_gsi(self, sparse_gsi_pk: str) -> list[IndexTtlRecord]:
        items = self._query_raw(
            key_condition_expression=Key("sparse_gsi_pk").eq(sparse_gsi_pk),
            index_name=SPARSE_GSI_NAME,
            scan_index_forward=True,
        )
        return [IndexTtlRecord.from_item(item) for item in items]

    def scan_expired(self, now_epoch: int) -> list[IndexTtlRecord]:
        items = self._scan_raw(
            filter_expression=Attr("ttl_epoch").lte(Decimal(str(now_epoch))),
        )
        return [IndexTtlRecord.from_item(item) for item in items]

    def delete(self, pk: str, sk: str) -> None:
        self._delete_raw(key={"pk": pk, "sk": sk})
