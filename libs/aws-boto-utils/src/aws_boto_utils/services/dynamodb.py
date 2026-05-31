from abc import ABC, abstractmethod
from collections.abc import Mapping
from typing import Any, Generic, TypeAlias, TypeVar

from boto3.dynamodb.conditions import ConditionBase, Key
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from aws_boto_utils.clients import create_resource
from aws_boto_utils.config import AwsClientConfig
from aws_boto_utils.exceptions import AwsServiceError

DynamoItemKey: TypeAlias = Mapping[str, Any]
DynamoKeyCondition: TypeAlias = ConditionBase | Mapping[str, Any]


class AbstractDynamoDbClient(ABC):
    @abstractmethod
    def put_item(self, table_name: str, item: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def get_item(
        self,
        table_name: str,
        key: DynamoItemKey,
        consistent_read: bool | None = None,
    ) -> dict[str, Any] | None:
        raise NotImplementedError

    @abstractmethod
    def update_item(
        self,
        table_name: str,
        key: DynamoItemKey,
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
        key: DynamoItemKey,
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
        key_condition_expression: DynamoKeyCondition,
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
        key: DynamoItemKey,
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
        key: DynamoItemKey,
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
        if isinstance(attributes, dict):
            return attributes

        raise AwsServiceError(
            f"UpdateItem did not return attributes: table={self.table_name}, key={key}, "
            f"return_values={return_values}"
        )

    def _update_attributes_raw(
        self,
        key: DynamoItemKey,
        set_values: dict[str, Any] | None = None,
        add_values: dict[str, Any] | None = None,
        remove_fields: list[str] | None = None,
        condition_expression: str | None = None,
        return_values: str = "ALL_NEW",
    ) -> dict[str, Any]:
        set_values = set_values or {}
        add_values = add_values or {}
        remove_fields = remove_fields or []

        if not set_values and not add_values and not remove_fields:
            raise ValueError("At least one update operation is required.")

        expression_parts: list[str] = []
        expression_attribute_names: dict[str, str] = {}
        expression_attribute_values: dict[str, Any] = {}

        if set_values:
            set_expressions = []
            for index, (field_name, value) in enumerate(set_values.items()):
                name_token = f"#set_name_{index}"
                value_token = f":set_value_{index}"
                expression_attribute_names[name_token] = field_name
                expression_attribute_values[value_token] = value
                set_expressions.append(f"{name_token} = {value_token}")
            expression_parts.append(f"SET {', '.join(set_expressions)}")

        if add_values:
            add_expressions = []
            for index, (field_name, value) in enumerate(add_values.items()):
                name_token = f"#add_name_{index}"
                value_token = f":add_value_{index}"
                expression_attribute_names[name_token] = field_name
                expression_attribute_values[value_token] = value
                add_expressions.append(f"{name_token} {value_token}")
            expression_parts.append(f"ADD {', '.join(add_expressions)}")

        if remove_fields:
            remove_expressions = []
            for index, field_name in enumerate(remove_fields):
                name_token = f"#remove_name_{index}"
                expression_attribute_names[name_token] = field_name
                remove_expressions.append(name_token)
            expression_parts.append(f"REMOVE {', '.join(remove_expressions)}")

        return self._update_raw(
            key=key,
            update_expression=" ".join(expression_parts),
            expression_attribute_names=expression_attribute_names,
            expression_attribute_values=expression_attribute_values,
            condition_expression=condition_expression,
            return_values=return_values,
        )

    def _delete_raw(
        self,
        key: DynamoItemKey,
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
        key_condition_expression: DynamoKeyCondition,
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


class DynamoDbClient(AbstractDynamoDbClient):
    def __init__(
        self,
        resource: Any | None = None,
        config: AwsClientConfig | None = None,
        region_name: str | None = None,
        endpoint_url: str | None = None,
        aws_access_key_id: str | None = None,
        aws_secret_access_key: str | None = None,
        aws_session_token: str | None = None,
    ) -> None:
        client_config = config or AwsClientConfig(
            region_name=region_name,
            endpoint_url=endpoint_url,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            aws_session_token=aws_session_token,
        )
        self._resource = resource or create_resource(
            "dynamodb",
            client_config,
            config=Config(retries={"max_attempts": 3, "mode": "standard"}),
        )

    @classmethod
    def from_config(cls, config: AwsClientConfig | None = None) -> "DynamoDbClient":
        return cls(config=config)

    def put_item(self, table_name: str, item: dict[str, Any]) -> dict[str, Any]:
        try:
            table = self._resource.Table(table_name)
            return table.put_item(Item=item)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to put DynamoDB item: {table_name}") from error

    def get_item(
        self,
        table_name: str,
        key: DynamoItemKey,
        consistent_read: bool | None = None,
    ) -> dict[str, Any] | None:
        table = self._resource.Table(table_name)
        params: dict[str, Any] = {"Key": key}
        if consistent_read is not None:
            params["ConsistentRead"] = consistent_read

        try:
            response = table.get_item(**params)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to get DynamoDB item: {table_name}") from error

        item = response.get("Item")
        return item if isinstance(item, dict) else None

    def update_item(
        self,
        table_name: str,
        key: DynamoItemKey,
        update_expression: str,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        condition_expression: str | None = None,
        return_values: str = "ALL_NEW",
    ) -> dict[str, Any]:
        table = self._resource.Table(table_name)
        params: dict[str, Any] = {
            "Key": key,
            "UpdateExpression": update_expression,
            "ReturnValues": return_values,
        }
        if expression_attribute_values:
            params["ExpressionAttributeValues"] = expression_attribute_values
        if expression_attribute_names:
            params["ExpressionAttributeNames"] = expression_attribute_names
        if condition_expression:
            params["ConditionExpression"] = condition_expression

        try:
            return table.update_item(**params)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to update DynamoDB item: {table_name}") from error

    def delete_item(
        self,
        table_name: str,
        key: DynamoItemKey,
        condition_expression: str | None = None,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        return_values: str | None = None,
    ) -> dict[str, Any]:
        table = self._resource.Table(table_name)
        params: dict[str, Any] = {"Key": key}
        if condition_expression:
            params["ConditionExpression"] = condition_expression
        if expression_attribute_values:
            params["ExpressionAttributeValues"] = expression_attribute_values
        if expression_attribute_names:
            params["ExpressionAttributeNames"] = expression_attribute_names
        if return_values:
            params["ReturnValues"] = return_values

        try:
            return table.delete_item(**params)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to delete DynamoDB item: {table_name}") from error

    def query(
        self,
        table_name: str,
        key_condition_expression: DynamoKeyCondition,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        index_name: str | None = None,
        filter_expression: Any | None = None,
        limit: int | None = None,
        scan_index_forward: bool | None = None,
        consistent_read: bool | None = None,
    ) -> list[dict[str, Any]]:
        table = self._resource.Table(table_name)
        params: dict[str, Any] = {
            "KeyConditionExpression": self._normalize_key_condition(key_condition_expression),
        }
        if expression_attribute_values:
            params["ExpressionAttributeValues"] = expression_attribute_values
        if expression_attribute_names:
            params["ExpressionAttributeNames"] = expression_attribute_names
        if index_name:
            params["IndexName"] = index_name
        if filter_expression is not None:
            params["FilterExpression"] = filter_expression
        if scan_index_forward is not None:
            params["ScanIndexForward"] = scan_index_forward
        if consistent_read is not None:
            params["ConsistentRead"] = consistent_read

        try:
            return self._collect_items(table.query, params, limit)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to query DynamoDB table: {table_name}") from error

    def scan(
        self,
        table_name: str,
        filter_expression: Any | None = None,
        expression_attribute_values: dict[str, Any] | None = None,
        expression_attribute_names: dict[str, str] | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        table = self._resource.Table(table_name)
        params: dict[str, Any] = {}
        if filter_expression is not None:
            params["FilterExpression"] = filter_expression
        if expression_attribute_values:
            params["ExpressionAttributeValues"] = expression_attribute_values
        if expression_attribute_names:
            params["ExpressionAttributeNames"] = expression_attribute_names

        try:
            return self._collect_items(table.scan, params, limit)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to scan DynamoDB table: {table_name}") from error

    def batch_write_items(
        self,
        table_name: str,
        items: list[dict[str, Any]],
    ) -> None:
        try:
            table = self._resource.Table(table_name)
            with table.batch_writer() as batch:
                for item in items:
                    batch.put_item(Item=item)
        except (BotoCoreError, ClientError) as error:
            raise AwsServiceError(f"Failed to batch write DynamoDB items: {table_name}") from error

    def _collect_items(
        self,
        operation: Any,
        params: dict[str, Any],
        limit: int | None,
    ) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        request_params = dict(params)

        while True:
            if limit is not None:
                remaining = limit - len(items)
                if remaining <= 0:
                    return items
                request_params["Limit"] = remaining

            response = operation(**request_params)
            items.extend(response.get("Items", []))

            last_evaluated_key = response.get("LastEvaluatedKey")
            if not last_evaluated_key:
                return items
            request_params["ExclusiveStartKey"] = last_evaluated_key

    def _normalize_key_condition(self, value: DynamoKeyCondition) -> Any:
        if not isinstance(value, Mapping):
            return value

        expression = None
        for field_name, field_value in value.items():
            condition = Key(field_name).eq(field_value)
            expression = condition if expression is None else expression & condition

        if expression is None:
            raise ValueError("key_condition_expression mapping must not be empty.")

        return expression
