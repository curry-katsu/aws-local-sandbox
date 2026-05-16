# DynamoDB GUI Specification

## Scope

This document describes the DynamoDB service console in the local GUI. The shared GUI runtime, navigation, and implementation boundaries are defined in [../gui.md](../gui.md).

## Current Behavior

The DynamoDB console supports:

- Table listing
- Table creation with partition key, optional sort key, key attribute types, and provisioned capacity inputs
- Table metadata summary
- Key schema and attribute definition display
- Item scan with configurable limit
- Key-based item query using the selected table schema
- Attribute filter scan with equals or contains matching
- Active result context display on the Items tab after scans, key queries, and filtered scans
- Full-table CSV export from the Items tab
- CSV import from the Items tab using `PutItem`
- JSON item creation through `PutItem`
- Selected item JSON loading into the Editor tab for editing
- Selected item deletion with confirmation
- Selected item JSON inspection

The item table keeps rows compact:

- Long values are shown as single-line ellipsized cells.
- Full item JSON is shown in the `Selected item JSON` panel after selecting a row.

The Items tab shows the active result context for the currently displayed rows:

- Unfiltered scans show the table name and scan limit.
- Key queries show the table name, result limit, partition key value, and sort key value when provided.
- Filtered scans show the table name, result limit, attribute name, operator, type, and search value.
- The context remains visible when moving from Search back to Items.
- The context is reset when switching tables and replaced when a new unfiltered scan runs.

The Editor tab makes its target explicit:

- Adding an item loads sample JSON and marks the editor as creating a new item.
- Editing a selected item loads the selected item JSON into the editor and marks the editor as editing a copied selected item.
- The editor shows key values parsed from the current JSON when the table schema keys are present.
- `PutItem` writes the JSON currently shown in the editor. If the JSON key values match an existing item, DynamoDB overwrites that item.

## CSV Import And Export

CSV export scans the full selected table instead of exporting only the rows currently loaded in the Items tab. This differs from the AWS console behavior intentionally because the local console is optimized for local inspection and verification.

CSV export behavior:

- The first row contains attribute names.
- The exported columns include table key attributes first, followed by all attributes found while scanning the table.
- Nested objects and lists are serialized as JSON strings inside CSV cells.
- Empty, missing, and null values are exported as empty cells.

CSV import behavior:

- The first row must contain attribute names.
- File selection opens a confirmation dialog before any row is written.
- Each non-empty data row is written with `PutItem`.
- Rows with key values that already exist overwrite the existing item.
- Rows missing the selected table's partition key or sort key are rejected.
- Key attributes use the selected table schema for number parsing. Object, array, boolean, and null-looking non-key cells are parsed from JSON-compatible text; other cells are imported as strings.

## Implementation Notes

- The DynamoDB console uses `gui/src/views/DynamoDbView.vue` for state management and AWS service calls, with presentation split under `gui/src/components/dynamodb/`.
- DynamoDB browser access belongs under `gui/src/aws/`; Vue components must not create AWS SDK clients or call `.send()` directly.
