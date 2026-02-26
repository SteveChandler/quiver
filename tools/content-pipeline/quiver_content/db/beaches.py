"""Beach queries for the content pipeline.

Provides functions to list, search, and inspect beaches in the Supabase
database, including gap analysis for editorial content coverage.
"""

from __future__ import annotations

import re

from rich.console import Console

from quiver_content.db.client import get_client

console = Console()


def _escape_ilike(value: str) -> str:
    """Escape SQL LIKE wildcards in user input."""
    return value.replace("%", "\\%").replace("_", "\\_")

# -------------------------------------------------------------------
# Layer 1 editorial columns that live directly on the beaches table.
# Used for gap analysis and column-level upserts.
# -------------------------------------------------------------------
EDITORIAL_COLUMNS: list[str] = [
    "description",
    "break_type",
    "crowd_level",
    "crowd_tips",
    "wave_tips",
    "best_conditions_prose",
    "access_tips",
    "parking_tips",
    "best_months",
    "hazards",
    "aspect_deg",
    "skill_level",
    "preferred_tide_direction",
    "preferred_tide_ft_min",
    "preferred_tide_ft_max",
    "features",
    "warnings",
    "local_etiquette",
    "real_takeaways",
]

# Lightweight columns returned by list_beaches.
_LIST_COLUMNS = "id, name, slug, city, state, lat, lon"


def list_beaches(
    state: str | None = None,
    city: str | None = None,
) -> list[dict]:
    """Return beaches with optional state/city filtering.

    Filters out soft-deleted rows (deleted_at IS NULL).
    Results are ordered by state, city, name.
    """
    client = get_client()
    query = (
        client.table("beaches")
        .select(_LIST_COLUMNS)
        .is_("deleted_at", "null")
        .order("state")
        .order("city")
        .order("name")
    )

    if state is not None:
        query = query.eq("state", state)
    if city is not None:
        query = query.ilike("city", city)

    response = query.execute()
    return response.data


def resolve_beach(query: str) -> dict | None:
    """Fuzzy-match a beach by name, slug, or partial match.

    Resolution priority:
        1. Exact slug match
        2. Exact name match (case-insensitive)
        3. Partial name match (ilike %query%)

    Returns the matched beach dict, or None if no match or if the match
    is ambiguous (multiple partial matches). When ambiguous, the
    candidates are printed to the console for the user to refine.
    """
    client = get_client()
    base_select = f"{_LIST_COLUMNS}, {', '.join(EDITORIAL_COLUMNS)}"

    # 0. UUID match (when query looks like a UUID)
    _UUID_RE = re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        re.IGNORECASE,
    )
    if _UUID_RE.match(query):
        id_result = (
            client.table("beaches")
            .select(base_select)
            .eq("id", query)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if id_result.data:
            return id_result.data[0]
        console.print(f"[yellow]No beach found with ID '{query}'[/yellow]")
        return None

    # 1. Exact slug match
    slug_result = (
        client.table("beaches")
        .select(base_select)
        .eq("slug", query)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    if slug_result.data:
        return slug_result.data[0]

    # 2. Exact name match (case-insensitive)
    name_result = (
        client.table("beaches")
        .select(base_select)
        .ilike("name", _escape_ilike(query))
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    if name_result.data:
        return name_result.data[0]

    # 3. Partial name match
    partial_result = (
        client.table("beaches")
        .select(base_select)
        .ilike("name", f"%{_escape_ilike(query)}%")
        .is_("deleted_at", "null")
        .order("name")
        .limit(16)
        .execute()
    )

    if not partial_result.data:
        console.print(f"[yellow]No beaches found matching '{query}'[/yellow]")
        return None

    if len(partial_result.data) == 1:
        return partial_result.data[0]

    # Ambiguous -- show candidates
    console.print(
        f"[yellow]Ambiguous query '{query}' matched "
        f"{len(partial_result.data)} beaches:[/yellow]"
    )
    for beach in partial_result.data[:15]:
        loc = ", ".join(filter(None, [beach.get("city"), beach.get("state")]))
        console.print(f"  - {beach['name']} ({loc}) [dim]slug={beach.get('slug')}[/dim]")
    if len(partial_result.data) > 15:
        console.print(f"  ... and {len(partial_result.data) - 15} more")
    return None


def get_beach_with_gaps(beach_id: str) -> dict:
    """Fetch a single beach by ID with all editorial columns and Layer 2 content.

    The returned dict contains:
        - All standard beach fields plus every editorial column.
        - ``editorial_content``: a list of existing rows from
          ``beach_editorial_content`` (Layer 2).
        - ``gap_count``: number of NULL editorial columns on the beach row.
        - ``gaps``: list of editorial column names that are NULL.
    """
    client = get_client()
    all_columns = f"{_LIST_COLUMNS}, {', '.join(EDITORIAL_COLUMNS)}"

    beach_result = (
        client.table("beaches")
        .select(all_columns)
        .eq("id", beach_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )

    if not beach_result.data:
        raise ValueError(f"Beach not found: {beach_id}")

    beach = beach_result.data[0]

    # Fetch Layer 2 editorial content
    editorial_result = (
        client.table("beach_editorial_content")
        .select("id, content_type, generated_at, updated_at")
        .eq("beach_id", beach_id)
        .execute()
    )
    beach["editorial_content"] = editorial_result.data

    # Gap analysis
    gaps = [col for col in EDITORIAL_COLUMNS if beach.get(col) is None]
    beach["gaps"] = gaps
    beach["gap_count"] = len(gaps)

    return beach


def get_beaches_with_gaps(state: str | None = None) -> list[dict]:
    """List beaches annotated with editorial gap counts.

    Each beach dict includes ``gap_count`` (number of NULL editorial
    columns) and ``gaps`` (list of those column names). Beaches are
    returned sorted by gap_count descending so the least-filled beaches
    appear first.
    """
    client = get_client()
    all_columns = f"{_LIST_COLUMNS}, {', '.join(EDITORIAL_COLUMNS)}"

    query = (
        client.table("beaches")
        .select(all_columns)
        .is_("deleted_at", "null")
        .order("state")
        .order("city")
        .order("name")
    )

    if state is not None:
        query = query.eq("state", state)

    response = query.execute()

    results: list[dict] = []
    for beach in response.data:
        gaps = [col for col in EDITORIAL_COLUMNS if beach.get(col) is None]
        beach["gaps"] = gaps
        beach["gap_count"] = len(gaps)
        results.append(beach)

    # Sort by gap_count descending so the emptiest beaches come first.
    results.sort(key=lambda b: b["gap_count"], reverse=True)
    return results
