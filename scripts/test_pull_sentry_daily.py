import json
import os
import runpy
import tempfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse


def test_discover_query() -> None:
    script = Path(__file__).with_name("pull_sentry_daily.py")
    requests: list[str] = []

    def fake_urlopen(request: object, timeout: int) -> BytesIO:
        url = request.full_url
        requests.append(url)
        payload = {"data": [{"count()": 12, "count_unique(user)": 0}]} if "/organizations/quiver-z4/events/" in url else []
        return BytesIO(json.dumps(payload).encode())

    with tempfile.TemporaryDirectory() as directory:
        output = Path(directory) / "sentry.json"
        env = {"SENTRY_READ_AUTH_TOKEN": "test-token", "SENTRY_OUTPUT": str(output), "SENTRY_RUN_END": "2026-09-23T15:00:00Z"}
        with patch.dict(os.environ, env), patch("urllib.request.urlopen", fake_urlopen):
            runpy.run_path(str(script), run_name="__main__")
        result = json.loads(output.read_text())

    discover = [url for url in requests if "/organizations/quiver-z4/events/" in url]
    assert len(discover) == 5
    assert all(parse_qs(urlparse(url).query)["project"] == ["4510293517205504"] for url in discover)
    assert all(parse_qs(urlparse(url).query)["query"] == ["event.type:error"] for url in discover)
    assert any(parse_qs(urlparse(url).query)["field"] == ["count()", "count_unique(user)"] for url in discover)
    assert result["error_counts_1d"]["rows"] == [{"count()": 12, "count_unique(user)": 0}]
    assert "error_events_1d" not in result


if __name__ == "__main__":
    test_discover_query()
