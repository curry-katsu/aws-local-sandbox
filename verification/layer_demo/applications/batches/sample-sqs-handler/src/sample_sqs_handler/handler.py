from batch_utils import batch_dependency_chain


def lambda_handler(event: dict, context: object) -> dict:
    return {
        "application": "sample-sqs-handler",
        "dependencies": [batch_dependency_chain()],
        "record_count": len(event.get("Records", [])),
    }


def main() -> None:
    print(lambda_handler({"Records": []}, None))
