from dataclasses import asdict


def serialize_result(result) -> dict:
    d = asdict(result)
    d["status"] = result.status.value
    return d


def count_by_status(results: list) -> dict[str, int]:
    counts: dict[str, int] = {}
    for r in results:
        counts[r.status.value] = counts.get(r.status.value, 0) + 1
    return counts
