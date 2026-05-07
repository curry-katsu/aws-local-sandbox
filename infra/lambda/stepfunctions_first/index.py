from __future__ import annotations

import json
from datetime import UTC, datetime


def handler(event, context):
    invoked_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")

    return {
        "step": "first",
        "status": "FIRST_LAMBDA_INVOKED",
        "message": "First Lambda processed the Step Functions input.",
        "invokedAt": invoked_at,
        "requestId": context.aws_request_id,
        "receivedInput": event,
        "nextPayload": {
            "source": "first-lambda",
            "originalMessage": event.get("message"),
            "processedAt": invoked_at,
        },
        "receivedInputJson": json.dumps(event, ensure_ascii=False),
    }
