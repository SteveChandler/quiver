"""Publish staged content to Supabase.

Reads reviewed JSON files from ``output/staging/{beach_id}/`` and
writes them to the appropriate Supabase tables:

- ``beach_columns.json`` -> direct column updates on the ``beaches`` table (Layer 1)
- ``{content_type}.json`` -> upsert to ``beach_editorial_content`` (Layer 2)
- ``photos/candidates.json`` -> insert to ``beach_photos`` with ``approved=false``
"""

from __future__ import annotations

from rich.console import Console

from quiver_content.db.editorial import (
    upsert_editorial,
    upsert_beach_columns,
    VALID_CONTENT_TYPES,
)
from quiver_content.db.photos import upsert_photos_batch
from quiver_content.staging.manager import (
    load_content,
    list_staged,
    load_photo_candidates,
)

console = Console()


def publish_content(beach_id: str, dry_run: bool = False) -> dict:
    """Publish all staged content for a beach to Supabase.

    Reads all JSON files from ``staging/{beach_id}/``:

    - ``beach_columns.json`` -> upsert to beaches table (Layer 1)
    - ``{content_type}.json`` -> upsert to beach_editorial_content (Layer 2)

    Args:
        beach_id: UUID of the beach.
        dry_run: If ``True``, log what would happen without writing.

    Returns:
        Dict with keys ``layer1`` (bool), ``layer2_types`` (list[str]),
        and ``errors`` (list[str]).
    """
    staged = list_staged(beach_id)
    if not staged:
        console.print(f"[yellow]No staged content found for {beach_id}[/yellow]")
        return {"layer1": False, "layer2_types": [], "errors": []}

    result: dict = {"layer1": False, "layer2_types": [], "errors": []}

    # Layer 1: beach_columns
    if "beach_columns" in staged:
        data = load_content(beach_id, "beach_columns")
        if data:
            if dry_run:
                console.print(
                    f"[dim]DRY RUN: Would update {len(data)} beach columns[/dim]"
                )
            else:
                try:
                    upsert_beach_columns(beach_id, data)
                    console.print(f"[green]Updated {len(data)} beach columns[/green]")
                except Exception as e:
                    result["errors"].append(f"beach_columns: {e}")
                    console.print(f"[red]Error updating beach columns: {e}[/red]")
            result["layer1"] = True

    # Layer 2: editorial content types
    for content_type in sorted(VALID_CONTENT_TYPES):
        if content_type in staged:
            data = load_content(beach_id, content_type)
            if data:
                if dry_run:
                    console.print(
                        f"[dim]DRY RUN: Would upsert {content_type}[/dim]"
                    )
                    result["layer2_types"].append(content_type)
                else:
                    try:
                        upsert_editorial(beach_id, content_type, data)
                        console.print(f"[green]Upserted {content_type}[/green]")
                        result["layer2_types"].append(content_type)
                    except Exception as e:
                        result["errors"].append(f"{content_type}: {e}")
                        console.print(
                            f"[red]Error upserting {content_type}: {e}[/red]"
                        )

    return result


def publish_photos(beach_id: str, dry_run: bool = False) -> int:
    """Publish staged photo candidates to Supabase with ``approved=false``.

    Args:
        beach_id: UUID of the beach.
        dry_run: If ``True``, log what would happen without writing.

    Returns:
        Count of photos published (or that *would* be published in dry-run).
    """
    candidates = load_photo_candidates(beach_id)
    if not candidates:
        console.print(f"[yellow]No photo candidates found for {beach_id}[/yellow]")
        return 0

    if dry_run:
        console.print(
            f"[dim]DRY RUN: Would insert {len(candidates)} photo candidates[/dim]"
        )
        return len(candidates)

    try:
        results = upsert_photos_batch(beach_id, candidates)
        console.print(f"[green]Published {len(results)} photos (approved=false)[/green]")
        return len(results)
    except Exception as e:
        console.print(f"[red]Error publishing photos: {e}[/red]")
        return 0
