"""Emit the Week Scout notes (schema 2) artifact fixture from the worker's own code.

Like `generate-python-worker-artifact.py`, nothing in the artifact is authored
by hand: the snapshot below mirrors `buildWeekScoutNotesInput`, the worker
validates it with `validate_snapshot`, picks with `merge_copy`, and stamps and
hashes the artifact exactly as `run()` does. The notes validator suite asserts
the server accepts it and agrees on both hashes.

Regenerate with the worker checkout as the argument:

    python3 generate-python-worker-notes-artifact.py <quiver-native>/scripts/swell-briefing/worker.py
"""

from __future__ import annotations

import datetime
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

OUT = Path(__file__).with_name("python-worker-notes-artifact.json")
USER = "bcdc5d59-2e22-4006-98a6-cada8618577a"
BLACKS = "6f1c1f3e-2b8a-4a55-9a43-0d1f3e1d6a01"
SCRIPPS = "6f1c1f3e-2b8a-4a55-9a43-0d1f3e1d6a02"


def load_worker(path: Path):
    spec = importlib.util.spec_from_file_location("briefing_worker", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def worker_commit(path: Path) -> str:
    try:
        return subprocess.check_output(["git", "-C", str(path.parent), "rev-parse", "HEAD"], text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def snapshot_for(worker) -> dict:
    wed = {"localDate": "2026-10-28", "beachId": BLACKS, "verdict": "worth_it", "bucket": "evening"}
    thu = {"localDate": "2026-10-29", "beachId": SCRIPPS, "verdict": "maybe", "bucket": "morning"}
    swell = {"eventKey": f"{BLACKS}:W:2026-10-30:p", "confidence": "likely"}
    snapshot = {
        "schemaVersion": 2,
        "userId": USER,
        "region": "san-diego",
        "editionDate": "2026-10-27",
        "sourcePublishedAt": "2026-10-27T12:00:00.000Z",
        "validUntil": "2026-10-29T06:59:59.000Z",
        "briefing": {
            "schemaVersion": 2,
            "kind": "week_scout_notes",
            "editionDate": "2026-10-27",
            "generatedAt": "2026-10-27T12:00:00.000Z",
            "notes": [],
        },
        "copyFacts": [
            {"id": "headline-worth", "slot": "headline", "text": "Wednesday looks worth it.",
             "gate": {"days": [wed], "swells": []}},
            {"id": "headline-worth-beach", "slot": "headline", "text": "Wednesday at Blacks looks like the call.",
             "gate": {"days": [wed], "swells": []}},
            {"id": "day-2026-10-28-0", "slot": "day:2026-10-28", "text": "Blacks in the evening looks worth it.",
             "gate": {"days": [wed], "swells": []}},
            {"id": "day-2026-10-28-1", "slot": "day:2026-10-28", "text": "Worth it in the evening.",
             "gate": {"days": [wed], "swells": []}},
            {"id": "day-2026-10-29-0", "slot": "day:2026-10-29", "text": "Scripps in the morning is a maybe.",
             "gate": {"days": [thu], "swells": []}},
            {"id": "swell-0-0", "slot": f"swell:{swell['eventKey']}", "text": "Likely, and still firming up.",
             "gate": {"days": [], "swells": [swell]}},
        ],
        "provenance": {
            "sourceIds": ["week_scout:san-diego:2026-10-27"],
            "sourceHashes": ["abc"],
            "generationInputVersion": "notes-1",
        },
    }
    snapshot["inputHash"] = worker.input_hash(snapshot)
    return snapshot


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    worker_path = Path(sys.argv[1]).resolve()
    worker = load_worker(worker_path)
    snapshot = snapshot_for(worker)
    finished = datetime.datetime(2026, 10, 27, 12, 31, 7, 123456, tzinfo=datetime.timezone.utc)
    worker.validate_snapshot(snapshot, {"userId": USER}, finished)

    # Picked out of issue order on purpose; the worker writes them in issue order.
    briefing = worker.merge_copy(
        snapshot, {"selections": ["swell-0-0", "day-2026-10-28-1", "headline-worth-beach"]},
    )
    briefing["generatedAt"] = finished.isoformat()

    content = {
        "schemaVersion": 2,
        "userId": snapshot["userId"],
        "region": snapshot["region"],
        "editionDate": snapshot["editionDate"],
        "inputHash": snapshot["inputHash"],
        "sourcePublishedAt": snapshot["sourcePublishedAt"],
        "validUntil": snapshot["validUntil"],
        "generationVersion": worker.GENERATION_VERSIONS[2],
        "model": "gemma4:12b-32k",
        "briefing": briefing,
        "provenance": snapshot["provenance"],
    }
    artifact = dict(content, artifactId=hashlib.sha256(worker.canonical(content)).hexdigest())

    fixture = {
        "generator": "lib/services/discovery/__tests__/fixtures/generate-python-worker-notes-artifact.py",
        "workerCommit": worker_commit(worker_path),
        "snapshot": snapshot,
        "artifact": artifact,
        "serverNow": "2026-10-27T12:32:00.000Z",
    }
    OUT.write_text(json.dumps(fixture, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT.name} from worker {fixture['workerCommit'][:8]}")


if __name__ == "__main__":
    main()
