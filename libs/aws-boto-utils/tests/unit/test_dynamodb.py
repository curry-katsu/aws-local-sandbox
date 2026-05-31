from typing import Any
from unittest.mock import MagicMock

import pytest

from aws_boto_utils.exceptions import AwsServiceError
from aws_boto_utils.services import BaseDynamoDao, DynamoDbClient


class SampleDao(BaseDynamoDao[dict[str, Any]]):
    table_name = "sample-table"


def test_dynamodb_client_get_item_returns_item() -> None:
    table = MagicMock()
    table.get_item.return_value = {"Item": {"pk": "ITEM#1", "sk": "PROFILE"}}
    resource = MagicMock()
    resource.Table.return_value = table

    item = DynamoDbClient(resource=resource).get_item(
        "sample-table",
        {"pk": "ITEM#1", "sk": "PROFILE"},
        consistent_read=True,
    )

    assert item == {"pk": "ITEM#1", "sk": "PROFILE"}
    resource.Table.assert_called_once_with("sample-table")
    table.get_item.assert_called_once_with(
        Key={"pk": "ITEM#1", "sk": "PROFILE"},
        ConsistentRead=True,
    )


def test_dynamodb_client_query_accepts_mapping_key_condition() -> None:
    table = MagicMock()
    table.query.return_value = {"Items": [{"pk": "ITEM#1", "sk": "PROFILE"}]}
    resource = MagicMock()
    resource.Table.return_value = table

    items = DynamoDbClient(resource=resource).query("sample-table", {"pk": "ITEM#1"})

    assert items == [{"pk": "ITEM#1", "sk": "PROFILE"}]
    call_args = table.query.call_args.kwargs
    assert "KeyConditionExpression" in call_args


def test_dynamodb_client_scan_paginates_until_limit() -> None:
    table = MagicMock()
    table.scan.side_effect = [
        {"Items": [{"pk": "ITEM#1"}], "LastEvaluatedKey": {"pk": "ITEM#1"}},
        {"Items": [{"pk": "ITEM#2"}]},
    ]
    resource = MagicMock()
    resource.Table.return_value = table

    items = DynamoDbClient(resource=resource).scan("sample-table", limit=2)

    assert items == [{"pk": "ITEM#1"}, {"pk": "ITEM#2"}]
    assert table.scan.call_args_list[0].kwargs == {"Limit": 2}
    assert table.scan.call_args_list[1].kwargs == {
        "ExclusiveStartKey": {"pk": "ITEM#1"},
        "Limit": 1,
    }


def test_base_dynamo_dao_update_attributes_builds_expression() -> None:
    client = MagicMock()
    client.update_item.return_value = {
        "Attributes": {"pk": "ITEM#1", "sk": "PROFILE", "status": "DONE"}
    }
    dao = SampleDao(client)

    item = dao._update_attributes_raw(
        key={"pk": "ITEM#1", "sk": "PROFILE"},
        set_values={"status": "DONE"},
        add_values={"attempt_count": 1},
        remove_fields=["obsolete"],
    )

    assert item == {"pk": "ITEM#1", "sk": "PROFILE", "status": "DONE"}
    client.update_item.assert_called_once_with(
        table_name="sample-table",
        key={"pk": "ITEM#1", "sk": "PROFILE"},
        update_expression=(
            "SET #set_name_0 = :set_value_0 " "ADD #add_name_0 :add_value_0 REMOVE #remove_name_0"
        ),
        expression_attribute_values={":set_value_0": "DONE", ":add_value_0": 1},
        expression_attribute_names={
            "#set_name_0": "status",
            "#add_name_0": "attempt_count",
            "#remove_name_0": "obsolete",
        },
        condition_expression=None,
        return_values="ALL_NEW",
    )


def test_base_dynamo_dao_update_attributes_requires_operation() -> None:
    dao = SampleDao(MagicMock())

    with pytest.raises(ValueError, match="At least one update operation is required"):
        dao._update_attributes_raw(key={"pk": "ITEM#1"})


def test_base_dynamo_dao_update_raw_requires_returned_attributes() -> None:
    client = MagicMock()
    client.update_item.return_value = {}
    dao = SampleDao(client)

    with pytest.raises(AwsServiceError, match="UpdateItem did not return attributes"):
        dao._update_raw(
            key={"pk": "ITEM#1", "sk": "PROFILE"},
            update_expression="SET #name = :value",
        )
