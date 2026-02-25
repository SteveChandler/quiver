"""Database access layer for Supabase."""

from quiver_content.db.client import get_client
from quiver_content.db.beaches import (
    EDITORIAL_COLUMNS,
    list_beaches,
    resolve_beach,
    get_beach_with_gaps,
    get_beaches_with_gaps,
)
from quiver_content.db.editorial import (
    VALID_CONTENT_TYPES,
    upsert_editorial,
    upsert_beach_columns,
)
from quiver_content.db.photos import (
    VALID_SOURCES,
    upsert_photo,
    upsert_photos_batch,
)

__all__ = [
    "get_client",
    "EDITORIAL_COLUMNS",
    "list_beaches",
    "resolve_beach",
    "get_beach_with_gaps",
    "get_beaches_with_gaps",
    "VALID_CONTENT_TYPES",
    "upsert_editorial",
    "upsert_beach_columns",
    "VALID_SOURCES",
    "upsert_photo",
    "upsert_photos_batch",
]
