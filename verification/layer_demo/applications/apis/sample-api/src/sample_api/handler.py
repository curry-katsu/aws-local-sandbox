from api_utils import api_dependency_chain
from sample_function import feature_dependency_chain


def lambda_handler(event: dict, context: object) -> dict:
    return {
        "statusCode": 200,
        "body": {
            "application": "sample-api",
            "dependencies": [api_dependency_chain(), feature_dependency_chain()],
            "event": event,
        },
    }


def main() -> None:
    print(lambda_handler({"source": "local"}, None))
