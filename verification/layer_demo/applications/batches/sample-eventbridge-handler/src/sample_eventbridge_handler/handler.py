from layer_demo_utils import dependency_marker


def lambda_handler(event: dict, context: object) -> dict:
    return {
        "application": "sample-eventbridge-handler",
        "dependencies": [dependency_marker()],
        "detail_type": event.get("detail-type"),
    }


def main() -> None:
    print(lambda_handler({"detail-type": "local"}, None))
