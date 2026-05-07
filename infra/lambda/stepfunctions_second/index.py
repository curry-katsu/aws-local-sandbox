from __future__ import annotations

import json
from datetime import UTC, datetime


def handler(event, context):
    invoked_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    first_result = event.get("firstLambdaResult", {})

    return {
        "step": "second",
        "status": "SECOND_LAMBDA_INVOKED",
        "message": "Second Lambda received the first Lambda result.",
        "invokedAt": invoked_at,
        "requestId": context.aws_request_id,
        "firstLambdaStatus": first_result.get("status"),
        "firstLambdaPayload": first_result.get("nextPayload"),
        "receivedState": event,
        "receivedStateJson": json.dumps(event, ensure_ascii=False),
    }
