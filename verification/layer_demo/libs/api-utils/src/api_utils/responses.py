from layer_demo_utils import dependency_marker


def api_dependency_chain() -> list[str]:
    return ["api-utils", dependency_marker()]
