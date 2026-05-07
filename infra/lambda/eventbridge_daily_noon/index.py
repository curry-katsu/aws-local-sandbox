from __future__ import annotations

import json
from datetime import UTC, datetime


def handler(event, context):
    invoked_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")

    print(
        json.dumps(
            {
                "message": "EventBridge daily noon JST Lambda invoked.",
                "invokedAt": invoked_at,
                "event": event,
                "requestId": context.aws_request_id,
            },
            ensure_ascii=False,
        )
    )

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "message": "ok",
                "invokedAt": invoked_at,
            }
        ),
    }
