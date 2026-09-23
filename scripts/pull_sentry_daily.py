#!/usr/bin/env python3
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

QUIVER_ROOT = Path("/Users/stevenchandler/Desktop/dev/quiver")


def load_quiver_env_value(name: str) -> str | None:
    direct = os.environ.get(name)
    if direct:
        return direct
    for path in (QUIVER_ROOT / ".env.production.local", QUIVER_ROOT / ".env.local", QUIVER_ROOT / ".env"):
        if not path.exists():
            continue
        for raw_line in path.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip() != name:
                continue
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            return value or None
    return None


def load_sentry_credentials() -> tuple[str, str]:
    env_token = load_quiver_env_value("SENTRY_READ_AUTH_TOKEN") or load_quiver_env_value("SENTRY_AUTH_TOKEN")
    if env_token:
        base_url = load_quiver_env_value("SENTRY_HOST") or load_quiver_env_value("SENTRY_URL") or "https://sentry.io"
        return base_url, env_token

    config = json.loads(TOKEN_PATH.read_text())
    credentials = next(iter(config.values()))
    return credentials.get("sentry_host", "https://sentry.io"), credentials["access_token"]


RUN_END = datetime.fromisoformat(
    os.environ.get("SENTRY_RUN_END", datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00")
)
ORG = load_quiver_env_value("SENTRY_ORG") or "quiver-z4"
PROJECT = load_quiver_env_value("SENTRY_PROJECT") or "javascript-nextjs"
PROJECT_ID = load_quiver_env_value("SENTRY_PROJECT_ID") or "4510293517205504"
TOKEN_PATH = Path.home() / ".sentry" / "mcp.json"

base_url, token = load_sentry_credentials()
base_url = base_url.rstrip("/")
if not base_url.startswith("http"):
    base_url = f"https://{base_url}"


def get(path: str, params: dict[str, str | list[str]]) -> dict | list:
    url = f"{base_url}{path}?{urlencode(params, doseq=True)}"
    request = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def read(path: str, params: dict[str, str | list[str]]) -> dict:
    try:
        payload = get(path, params)
        return {"status": 200, "rows": payload.get("data", payload) if isinstance(payload, dict) else payload}
    except Exception as exc:
        return {"status": getattr(exc, "code", None), "error": str(exc)}


def window(days: int) -> dict[str, str]:
    start = RUN_END - timedelta(days=days)
    return {"start": start.isoformat().replace("+00:00", "Z"), "end": RUN_END.isoformat().replace("+00:00", "Z")}


result = {
    "pulled_at": datetime.now(timezone.utc).isoformat(),
    "organization": ORG,
    "project": PROJECT,
    "project_id": PROJECT_ID,
    "error_query_source": "organization_discover",
    "windows": {f"{days}d": window(days) for days in (1, 7, 14)},
    "projects": read(f"/api/0/organizations/{ORG}/projects/", {"limit": "100"}),
    "unresolved_24h": read(f"/api/0/projects/{ORG}/{PROJECT}/issues/", {"query": "is:unresolved", "statsPeriod": "24h", "limit": "100"}),
}
for days in (7, 14):
    result[f"unresolved_{days}d"] = read(
        f"/api/0/projects/{ORG}/{PROJECT}/issues/",
        {"query": "is:unresolved", "start": result["windows"][f"{days}d"]["start"], "end": result["windows"][f"{days}d"]["end"], "limit": "100"},
    )
for days in (1, 7, 14):
    params = {"project": PROJECT_ID, "query": "event.type:error", **result["windows"][f"{days}d"]}
    result[f"error_counts_{days}d"] = read(
        f"/api/0/organizations/{ORG}/events/",
        {**params, "field": ["count()", "count_unique(user)"]},
    )
    if days in (1, 7):
        result[f"error_issues_{days}d"] = read(
            f"/api/0/organizations/{ORG}/events/",
            {**params, "field": ["issue", "issue.id", "title", "count()", "count_unique(user)", "max(timestamp)"], "sort": "-count", "per_page": "20"},
        )
output_path = Path(os.environ.get(
    "SENTRY_OUTPUT",
    "/Users/stevenchandler/.codex/automations/daily-user-stats/sentry-2026-07-18.json",
))
output_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
