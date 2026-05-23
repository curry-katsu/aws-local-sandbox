from layer_demo_utils import dependency_marker


def feature_dependency_chain() -> list[str]:
    return ["sample-function", dependency_marker()]
