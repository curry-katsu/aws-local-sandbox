from layer_demo_utils import dependency_marker


def batch_dependency_chain() -> list[str]:
    return ["batch-utils", dependency_marker()]
