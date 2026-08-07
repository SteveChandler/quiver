"""Emit the Quiver-side real-issue fixture from 21-01's own serialized output.

Every row written here is produced by running the SHIPPED Seaside production
parsers (`trusted_forecasts.parsers`) and the SHIPPED
`crons.fetch_trusted_forecasts._serialize_issue` over the bounded corpus in
`seaside/tests/fixtures/trusted_forecasts/corpus.json`. Nothing is authored by
hand. The generator command is recorded in the fixture header so the file can be
regenerated and diffed.
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

SEASIDE = Path("/Users/stevenchandler/Desktop/dev/seaside")
sys.path.insert(0, str(SEASIDE))

from crons.fetch_trusted_forecasts import _serialize_issue  # noqa: E402
from trusted_forecasts import parsers  # noqa: E402
from trusted_forecasts.sources import SOURCES_BY_KEY  # noqa: E402

FIXTURES = SEASIDE / "tests/fixtures/trusted_forecasts"
CORPUS = json.loads((FIXTURES / "corpus.json").read_text())
DOCUMENTS: dict[str, dict[str, Any]] = CORPUS["documents"]

SELECTED: tuple[str, ...] = (
    "wavecast_regional_live_hawaii",
    "wavecast_regional_live_new_york",
    "wavecast_regional_dst_spring_23h",
    "wavecast_regional_dst_fall_25h",
    "wavecast_spot_chart_live_trestles",
    "wavecast_spot_chart_live_malibu",
    "wavecast_socal_index_live",
    "nws_hawaii_srf_live_morning_issuance",
    "nws_hawaii_srf_live_evening_issuance",
    "surf_institute_pnw_live",
    "stormsurf_ny_shortcast_live",
)


def document_body(doc: dict[str, Any]) -> str:
    if "body" in doc:
        return doc["body"]
    body = (FIXTURES / "captures" / doc["capture"]).read_text()
    for old, new, count in doc.get("replace", []):
        assert old in body
        body = body.replace(old, new) if count == 0 else body.replace(old, new, count)
    if "truncate_bytes" in doc:
        body = body.encode("utf-8")[: doc["truncate_bytes"]].decode(
            "utf-8", errors="ignore"
        )
    return body


def parse(fixture_id: str, doc: dict[str, Any]) -> list[Any]:
    source = SOURCES_BY_KEY[doc["source_key"]]
    if "spot_chart" in fixture_id:
        return parsers.parse_wavecast_spot_chart(
            source=source,
            document=document_body(doc),
            fetched_at=datetime.fromisoformat(doc["fetched_at"]),
            spot_slug=doc["spot_slug"],
        )
    return parsers.dispatch(
        source=source,
        document=document_body(doc),
        fetched_at=datetime.fromisoformat(doc["fetched_at"]),
    )


def seaside_head() -> str:
    return subprocess.run(
        ["git", "-C", str(SEASIDE), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()


def main() -> int:
    documents: dict[str, Any] = {}
    total = 0
    for fixture_id in SELECTED:
        doc = DOCUMENTS[fixture_id]
        assert doc["expectation"] == "accept", fixture_id
        issues = [_serialize_issue(issue) for issue in parse(fixture_id, doc)]
        total += len(issues)
        documents[fixture_id] = {
            "sourceKey": doc["source_key"],
            "capture": doc.get("capture"),
            "inlineBody": "body" in doc,
            "note": doc.get("note"),
            "fetchedAt": doc["fetched_at"],
            "issues": issues,
        }

    payload = {
        "provenance": {
            "generatedBy": "lib/services/forecast/__tests__/fixtures/generate-trusted-forecast-issue-fixture.py",
            "seasideRepo": str(SEASIDE),
            "seasideHead": seaside_head(),
            "seasideCorpus": "tests/fixtures/trusted_forecasts/corpus.json",
            "seasideCorpusVersion": CORPUS["corpus_version"],
            "producedBy": (
                "trusted_forecasts.parsers.dispatch / parse_wavecast_spot_chart "
                "then crons.fetch_trusted_forecasts._serialize_issue"
            ),
            "everyRowIsRealParserOutput": True,
        },
        "issueCount": total,
        "documents": documents,
    }
    out = Path(sys.argv[1])
    out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    print(f"wrote {total} real issues across {len(documents)} documents -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
