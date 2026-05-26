from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar


class AbstractDynamoDbClient(ABC):
    @abstractmethod
    def put_item(self, table_name: str, item: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def get_item(
        self,
        table_name: str,
        key: dict[str, Any],
        consistent_read: bool | None = None,
    ) -> dict[str, Any] | None:
        raise NotImplementedError

    @abstractmethod
    def update_item(
        self,
        table_name: str,
        key: dict[str, Any],
        update_expression: str,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        condition_expression: str | None = None,
        return_values: str = "ALL_NEW",
    ) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def delete_item(
        self,
        table_name: str,
        key: dict[str, Any],
        condition_expression: str | None = None,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        return_values: str | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def query(
        self,
        table_name: str,
        key_condition_expression: Any,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        index_name: str | None = None,
        filter_expression: Any | None = None,
        limit: int | None = None,
        scan_index_forward: bool | None = None,
        consistent_read: bool | None = None,
    ) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def scan(
        self,
        table_name: str,
        filter_expression: Any | None = None,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def batch_write_items(
        self,
        table_name: str,
        items: list[dict[str, Any]],
    ) -> None:
        raise NotImplementedError


DataT = TypeVar("DataT")


class BaseDynamoDao(Generic[DataT]):
    table_name: str

    def __init__(self, client: AbstractDynamoDbClient) -> None:
        self.client = client

    def _get_raw(
        self,
        key: dict[str, Any],
        consistent_read: bool | None = None,
    ) -> dict[str, Any] | None:
        return self.client.get_item(
            table_name=self.table_name,
            key=key,
            consistent_read=consistent_read,
        )

    def _put_raw(self, item: dict[str, Any]) -> None:
        self.client.put_item(
            table_name=self.table_name,
            item=item,
        )

    def _update_raw(
        self,
        key: dict[str, Any],
        update_expression: str,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        condition_expression: str | None = None,
        return_values: str = "ALL_NEW",
    ) -> dict[str, Any]:
        response = self.client.update_item(
            table_name=self.table_name,
            key=key,
            update_expression=update_expression,
            expression_attribute_values=expression_attribute_values,
            expression_attribute_names=expression_attribute_names,
            condition_expression=condition_expression,
            return_values=return_values,
        )
        attributes = response.get("Attributes")
        return attributes if isinstance(attributes, dict) else {}

    def _delete_raw(
        self,
        key: dict[str, Any],
        condition_expression: str | None = None,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        return_values: str | None = None,
    ) -> dict[str, Any]:
        return self.client.delete_item(
            table_name=self.table_name,
            key=key,
            condition_expression=condition_expression,
            expression_attribute_values=expression_attribute_values,
            expression_attribute_names=expression_attribute_names,
            return_values=return_values,
        )

    def _query_raw(
        self,
        key_condition_expression: Any,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        index_name: str | None = None,
        filter_expression: Any | None = None,
        scan_index_forward: bool | None = None,
        consistent_read: bool | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        return self.client.query(
            table_name=self.table_name,
            key_condition_expression=key_condition_expression,
            expression_attribute_values=expression_attribute_values,
            expression_attribute_names=expression_attribute_names,
            index_name=index_name,
            filter_expression=filter_expression,
            scan_index_forward=scan_index_forward,
            consistent_read=consistent_read,
            limit=limit,
        )

    def _scan_raw(
        self,
        filter_expression: Any | None = None,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        return self.client.scan(
            table_name=self.table_name,
            filter_expression=filter_expression,
            expression_attribute_values=expression_attribute_values,
            expression_attribute_names=expression_attribute_names,
            limit=limit,
        )

    def _batch_put_raw(self, items: list[dict[str, Any]]) -> None:
        self.client.batch_write_items(
            table_name=self.table_name,
            items=items,
        )
