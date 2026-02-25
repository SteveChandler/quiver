"""Beach photo upserts for the content pipeline.

All photos inserted through the pipeline are set to ``approved=False``
so they require manual review before appearing in the public-facing
featured photo view.
"""

from __future__ import annotations

from quiver_content.db.client import get_client

# Valid source values (must match the CHECK constraint on beach_photos).
VALID_SOURCES: set[str] = frozenset(
    {"openverse", "flickr", "unsplash", "pexels", "wikimedia", "user"}
)

# Required fields every photo dict must contain.
_REQUIRED_FIELDS: set[str] = {"source", "source_id", "image_url"}

# Optional fields that may be present on a photo dict.
_OPTIONAL_FIELDS: set[str] = {
    "thumb_url",
    "title",
    "creator_name",
    "creator_url",
    "license_code",
    "license_url",
    "attribution_html",
}

# All recognized photo fields (required + optional + system-managed).
_ALL_FIELDS: set[str] = _REQUIRED_FIELDS | _OPTIONAL_FIELDS


def _validate_photo(photo: dict) -> None:
    """Raise ValueError if required fields are missing or source is invalid."""
    missing = _REQUIRED_FIELDS - set(photo.keys())
    if missing:
        raise ValueError(f"Photo is missing required field(s): {', '.join(sorted(missing))}")

    if photo["source"] not in VALID_SOURCES:
        raise ValueError(
            f"Invalid photo source '{photo['source']}'. "
            f"Must be one of: {', '.join(sorted(VALID_SOURCES))}"
        )


def upsert_photo(beach_id: str, photo: dict) -> dict:
    """Upsert a single photo to ``beach_photos``.

    Uses ``ON CONFLICT (beach_id, source, source_id)`` so duplicate
    imports for the same source photo update in place. The ``approved``
    flag is always set to ``False`` for pipeline-inserted photos.

    Args:
        beach_id: UUID of the beach.
        photo: Dict with at least ``source``, ``source_id``, and
            ``image_url``. May also contain any of the optional fields.

    Returns:
        The upserted row as a dict.
    """
    _validate_photo(photo)

    client = get_client()

    row: dict = {"beach_id": beach_id, "approved": False}

    # Copy recognized fields from photo, skip unknown keys
    for key in _ALL_FIELDS:
        if key in photo:
            row[key] = photo[key]

    response = (
        client.table("beach_photos")
        .upsert(row, on_conflict="beach_id,source,source_id")
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            f"Upsert to beach_photos failed for beach_id={beach_id}, "
            f"source={photo.get('source')}, source_id={photo.get('source_id')}"
        )

    return response.data[0]


def upsert_photos_batch(beach_id: str, photos: list[dict]) -> list[dict]:
    """Upsert multiple photos for a single beach.

    Each photo is validated individually. The batch is sent as a single
    upsert call for efficiency.

    Args:
        beach_id: UUID of the beach.
        photos: List of photo dicts (same format as ``upsert_photo``).

    Returns:
        List of upserted row dicts.

    Raises:
        ValueError: If any photo in the batch fails validation. The
            entire batch is rejected (no partial writes).
    """
    if not photos:
        return []

    # Validate all photos before writing any
    for i, photo in enumerate(photos):
        try:
            _validate_photo(photo)
        except ValueError as exc:
            raise ValueError(f"Photo at index {i}: {exc}") from exc

    client = get_client()

    rows: list[dict] = []
    for photo in photos:
        row: dict = {"beach_id": beach_id, "approved": False}
        for key in _ALL_FIELDS:
            if key in photo:
                row[key] = photo[key]
        rows.append(row)

    response = (
        client.table("beach_photos")
        .upsert(rows, on_conflict="beach_id,source,source_id")
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            f"Batch upsert to beach_photos failed for beach_id={beach_id} "
            f"({len(photos)} photos)"
        )

    return response.data
