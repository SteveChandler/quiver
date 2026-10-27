"""Emit the briefing artifact fixture from the local worker's own code.

The artifact in `python-worker-artifact.json` is produced by running the
shipped worker's `merge_copy`, its `run()` generation stamp and its canonical
artifact id over the snapshot below. Nothing in the artifact is authored by
hand. The validator suite asserts against it, so when the worker changes how it
writes copy or stamps `generatedAt`, regenerating this file is what makes the
suite notice - a hand-written artifact would stay green while real uploads were
refused, which is the failure this fixture was added to catch.

The snapshot is written here to mirror `buildBriefingInput`, with two deliberate
extras: a `week:` candidate, which the worker supports though the builder does
not emit one yet, and a `next48` day with no candidates, whose backend note must
survive. Both exercise contract paths the validator has to get right.

Regenerate with the worker checkout as the argument:

    python3 generate-python-worker-artifact.py <quiver-native>/scripts/swell-briefing/worker.py

then run the validator and serve suites.
"""

from __future__ import annotations

import datetime
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

OUT = Path(__file__).with_name("python-worker-artifact.json")
CARDIFF = "80efa1c0-37a2-4879-819b-647ae3c3d749"


def load_worker(path: Path):
    spec = importlib.util.spec_from_file_location("briefing_worker", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def worker_commit(path: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "-C", str(path.parent), "rev-parse", "HEAD"], text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def snapshot_for(worker) -> dict:
    briefing = {
        "editionDate": "2026-10-26",
        "regionLabel": "San Diego",
        "headline": "Today's surf across the region.",
        "generatedAt": "2026-10-26T12:00:00.000Z",
        "dataAt": "2026-10-26T11:50:00.000Z",
        "freshness": "fresh",
        "photo": None,
        "today": {
            "date": "2026-10-26",
            "exposures": [{
                "exposure": "south_facing", "label": "South-facing",
                "surfFt": {"min": 2, "max": 3.5}, "surfLabel": "waist – chest",
                "beach": {"id": CARDIFF, "name": "Cardiff Reef"},
            }],
            "primaryDirectionDeg": 202, "primaryDirectionLabel": "SSW SWELL",
            "primaryPeriodS": 12.35, "call": None,
        },
        "next48": [
            {"date": "2026-10-27", "note": "Cleanest early.", "periods": [{
                "period": "am", "kind": "offshore", "label": "OFFSHORE",
                "speedLabel": "5 – 10 mph", "speedMph": 10, "directionDeg": 45,
                "surfFt": {"min": 2, "max": 3}, "surfLabel": "waist high",
            }]},
            {"date": "2026-10-28", "note": "Backend note, no candidates.", "periods": []},
        ],
        "week": [
            {"date": "2026-10-26", "surfFt": {"min": 2, "max": 3.5}, "trend": "small", "label": "Small",
             "uncertain": False, "highlightLabel": None, "caveat": None, "beach": None},
            {"date": "2026-10-27", "surfFt": {"min": 3, "max": 5}, "trend": "building", "label": "Building",
             "uncertain": False, "highlightLabel": None, "caveat": None, "beach": None},
        ],
        "advisories": [],
    }
    snapshot = {
        "schemaVersion": 1,
        "userId": "bcdc5d59-2e22-4006-98a6-cada8618577a",
        "region": "san-diego",
        "editionDate": "2026-10-26",
        "sourcePublishedAt": "2026-10-26T11:50:00.000Z",
        "validUntil": "2026-10-28T06:59:59.000Z",
        "briefing": briefing,
        "copyFacts": [
            {"id": "headline-small", "slot": "headline", "text": "Small to start the week."},
            {"id": "today-qualified", "slot": "todayCall", "text": "An early check may be worthwhile."},
            {"id": "next48-clean-2026-10-27", "slot": "next48:2026-10-27", "text": "Cleanest early."},
            {"id": "week-builds-2026-10-27", "slot": "week:2026-10-27", "text": "More size arriving."},
        ],
        "provenance": {
            "sourceIds": ["enhanced_forecasts:san-diego:2026-10-26"],
            "sourceHashes": ["abc"],
            "generationInputVersion": "1",
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

    # The model picks the headline, the today call and the week line, and not
    # the offered next48 note - so merge_copy clears that one.
    briefing = worker.merge_copy(
        snapshot,
        {"selections": ["headline-small", "today-qualified", "week-builds-2026-10-27"]},
    )
    # Stamped exactly as run() does, after inference finishes.
    finished = datetime.datetime(2026, 10, 26, 12, 31, 7, 123456, tzinfo=datetime.timezone.utc)
    briefing["generatedAt"] = finished.isoformat()

    content = {
        "schemaVersion": 1,
        "userId": snapshot["userId"],
        "region": snapshot["region"],
        "editionDate": snapshot["editionDate"],
        "inputHash": snapshot["inputHash"],
        "sourcePublishedAt": snapshot["sourcePublishedAt"],
        "validUntil": snapshot["validUntil"],
        "generationVersion": getattr(worker, "GENERATION_VERSIONS", {1: worker.VERSION})[1],
        "model": "gemma4:12b-32k",
        "briefing": briefing,
        "provenance": snapshot["provenance"],
    }
    artifact = dict(content, artifactId=hashlib.sha256(worker.canonical(content)).hexdigest())

    fixture = {
        "generator": "lib/services/discovery/__tests__/fixtures/generate-python-worker-artifact.py",
        "workerCommit": worker_commit(worker_path),
        "snapshot": snapshot,
        "artifact": artifact,
        "serverNow": "2026-10-26T12:32:00.000Z",
    }
    OUT.write_text(json.dumps(fixture, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT.name} from worker {fixture['workerCommit'][:8]}")


if __name__ == "__main__":
    main()
