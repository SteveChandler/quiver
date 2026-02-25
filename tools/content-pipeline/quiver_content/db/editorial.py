"""Editorial content upserts for the content pipeline.

Handles writes to both the ``beach_editorial_content`` table (Layer 2
structured JSONB notes) and direct column updates on the ``beaches``
table (Layer 1 editorial fields).
"""

from __future__ import annotations

from datetime import datetime, timezone

from quiver_content.db.client import get_client
from quiver_content.db.beaches import EDITORIAL_COLUMNS

# Valid content_type values for beach_editorial_content (must match the
# CHECK constraint defined in the migration).
VALID_CONTENT_TYPES: set[str] = frozenset(
    {
        "beginner_notes",
        "tide_notes",
        "safety_notes",
        "advanced_notes",
        "crowd_notes",
    }
)

# Valid values for beaches.preferred_tide_direction CHECK constraint.
VALID_TIDE_DIRECTIONS: set[str] = frozenset(
    {"rising", "falling", "either", "slack"}
)

# Common synonyms that users/LLMs might generate → canonical value.
_TIDE_DIRECTION_ALIASES: dict[str, str] = {
    "outgoing": "falling",
    "incoming": "rising",
    "ebbing": "falling",
    "flooding": "rising",
    "any": "either",
    "both": "either",
    "low": "falling",
    "high": "rising",
}


def _normalize_tide_direction(value: str) -> str:
    """Map a tide direction value to one accepted by the DB constraint.

    Raises ``ValueError`` if the value (or its alias) is not recognised.
    """
    clean = value.strip().lower()
    if clean in VALID_TIDE_DIRECTIONS:
        return clean
    if clean in _TIDE_DIRECTION_ALIASES:
        return _TIDE_DIRECTION_ALIASES[clean]
    raise ValueError(
        f"Invalid preferred_tide_direction '{value}'. "
        f"Must be one of: {', '.join(sorted(VALID_TIDE_DIRECTIONS))} "
        f"(aliases accepted: {', '.join(sorted(_TIDE_DIRECTION_ALIASES))})"
    )


def upsert_editorial(beach_id: str, content_type: str, content: dict) -> dict:
    """Upsert a row in ``beach_editorial_content``.

    Uses ``ON CONFLICT (beach_id, content_type)`` so repeated calls for
    the same beach + content_type update in place.

    Args:
        beach_id: UUID of the beach.
        content_type: One of ``VALID_CONTENT_TYPES``.
        content: Arbitrary JSONB payload (schema varies by content_type).

    Returns:
        The upserted row as a dict.

    Raises:
        ValueError: If ``content_type`` is not in the allowed set.
    """
    if content_type not in VALID_CONTENT_TYPES:
        raise ValueError(
            f"Invalid content_type '{content_type}'. "
            f"Must be one of: {', '.join(sorted(VALID_CONTENT_TYPES))}"
        )

    client = get_client()
    row = {
        "beach_id": beach_id,
        "content_type": content_type,
        "content": content,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    response = (
        client.table("beach_editorial_content")
        .upsert(row, on_conflict="beach_id,content_type")
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            f"Upsert to beach_editorial_content failed for "
            f"beach_id={beach_id}, content_type={content_type}"
        )

    return response.data[0]


def upsert_beach_columns(beach_id: str, columns: dict) -> dict:
    """Update Layer 1 editorial columns directly on the ``beaches`` table.

    Only non-None values from *columns* are written. Column names are
    validated against the known ``EDITORIAL_COLUMNS`` list.

    Args:
        beach_id: UUID of the beach to update.
        columns: Mapping of column name to value. Keys must be in
            ``EDITORIAL_COLUMNS``; None values are skipped.

    Returns:
        The updated beach row (editorial columns only).

    Raises:
        ValueError: If any key in *columns* is not a known editorial column.
    """
    # Validate column names
    invalid_keys = set(columns.keys()) - set(EDITORIAL_COLUMNS)
    if invalid_keys:
        raise ValueError(
            f"Invalid editorial column(s): {', '.join(sorted(invalid_keys))}. "
            f"Allowed columns: {', '.join(EDITORIAL_COLUMNS)}"
        )

    # Filter out None values -- only write columns that have a value
    update_payload = {k: v for k, v in columns.items() if v is not None}

    if not update_payload:
        raise ValueError("No non-None columns to update.")

    # Normalize constrained enum columns before sending to DB
    if "preferred_tide_direction" in update_payload:
        update_payload["preferred_tide_direction"] = _normalize_tide_direction(
            update_payload["preferred_tide_direction"]
        )

    client = get_client()
    response = (
        client.table("beaches")
        .update(update_payload)
        .eq("id", beach_id)
        .is_("deleted_at", "null")
        .execute()
    )

    if not response.data:
        raise ValueError(
            f"Beach not found or is soft-deleted: beach_id={beach_id}"
        )

    return response.data[0]
