"""CLI entry point for quiver-content pipeline."""

import asyncio
import json
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from quiver_content.config import ensure_dirs, validate_config

console = Console()


def _resolve(query: str) -> dict:
    """Resolve a beach name/slug to a beach dict. Exit if not found."""
    from quiver_content.db.beaches import resolve_beach

    beach = resolve_beach(query)
    if beach is None:
        console.print(f"[red]Could not resolve beach: {query}[/red]")
        console.print("[dim]Try a more specific name or use the exact slug.[/dim]")
        sys.exit(1)
    return beach


@click.group()
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
@click.pass_context
def cli(ctx, verbose):
    """Quiver Content Pipeline - Beach editorial content enrichment."""
    ctx.ensure_object(dict)
    ctx.obj["verbose"] = verbose
    ensure_dirs()


@cli.command()
@click.option("--state", "-s", help="Filter by state code (e.g., CA, HI)")
@click.option("--city", "-c", help="Filter by city")
@click.option(
    "--format", "fmt", type=click.Choice(["table", "json"]), default="table"
)
@click.pass_context
def audit(ctx, state, city, fmt):
    """Show editorial data coverage gaps for beaches."""
    validate_config()
    from quiver_content.db.beaches import get_beaches_with_gaps

    beaches = get_beaches_with_gaps(state=state)
    if city:
        beaches = [b for b in beaches if b.get("city", "").lower() == city.lower()]

    if not beaches:
        console.print("[yellow]No beaches found matching filters.[/yellow]")
        return

    if fmt == "json":
        click.echo(json.dumps(beaches, indent=2, default=str))
        return

    table = Table(
        title=f"Editorial Coverage Gaps{f' - {state}' if state else ''}"
    )
    table.add_column("Beach", style="cyan")
    table.add_column("City")
    table.add_column("State")
    table.add_column("Gaps", justify="right", style="red")
    table.add_column("Missing Columns", style="dim")

    for b in beaches:
        # gaps is a list of column names, gap_count is an int
        missing_cols = b.get("gaps", [])
        gap_count = b.get("gap_count", 0)

        # Show first few missing columns
        missing_preview = ", ".join(missing_cols[:5])
        if gap_count > 5:
            missing_preview += f" (+{gap_count - 5} more)"

        table.add_row(
            b["name"],
            b.get("city", "-"),
            b.get("state", "-"),
            str(gap_count),
            missing_preview or "[green]complete[/green]",
        )

    console.print(table)
    console.print(f"\n[dim]{len(beaches)} beaches total[/dim]")


@cli.command()
@click.argument("beach_query")
@click.option(
    "--sources",
    "-s",
    multiple=True,
    type=click.Choice(["wikipedia", "government", "wannasurf", "osm"]),
    help="Which sources to crawl (default: all). wannasurf=surf spot data, osm=amenities",
)
@click.option("--force", is_flag=True, help="Ignore cache and re-crawl")
@click.pass_context
def crawl(ctx, beach_query, sources, force):
    """Crawl source material for a single beach."""
    validate_config()
    from quiver_content.db.beaches import get_beach_with_gaps
    from quiver_content.pipeline.enrich import enrich_beach

    beach = _resolve(beach_query)
    beach_detail = get_beach_with_gaps(beach["id"])
    verbose = ctx.obj["verbose"]

    console.print(f"[bold]Crawling sources for {beach['name']}...[/bold]")

    result = asyncio.run(
        enrich_beach(
            beach_detail,
            sources=list(sources) if sources else None,
            skip_images=True,
            force_crawl=force,
            verbose=verbose,
        )
    )

    n_sources = len(result.get("crawl_results", []))
    console.print(f"\n[green]Done![/green] {n_sources} sources crawled.")
    if result.get("sources_path"):
        console.print(f"[dim]Sources saved to: {result['sources_path']}[/dim]")
    if result.get("errors"):
        for err in result["errors"]:
            console.print(f"[red]Error: {err}[/red]")


@cli.command("crawl-batch")
@click.option(
    "--state", "-s", required=True, help="State code (e.g., CA, HI)"
)
@click.option(
    "--city", "-c", multiple=True,
    help="Filter to specific city/cities (can repeat: -c 'San Diego' -c 'La Jolla')"
)
@click.option(
    "--missing-only", is_flag=True, help="Only crawl beaches with editorial gaps"
)
@click.option(
    "--limit", "-l", type=int, default=50, help="Max beaches to process"
)
@click.option("--concurrency", type=int, default=3, help="Max concurrent crawls")
@click.option("--force", is_flag=True, help="Ignore cache and re-crawl")
@click.pass_context
def crawl_batch(ctx, state, city, missing_only, limit, concurrency, force):
    """Crawl source material for multiple beaches in a state."""
    validate_config()
    from quiver_content.db.beaches import get_beaches_with_gaps, list_beaches
    from quiver_content.pipeline.batch import enrich_batch

    verbose = ctx.obj["verbose"]

    if missing_only:
        beaches = get_beaches_with_gaps(state=state)
        # Filter to only those with actual gaps
        beaches = [b for b in beaches if b.get("gap_count", 0) > 0]
    else:
        beaches = list_beaches(state=state)

    # Filter by city if specified
    if city:
        city_set = {c.lower() for c in city}
        beaches = [b for b in beaches if b.get("city", "").lower() in city_set]

    beaches = beaches[:limit]

    if not beaches:
        console.print("[yellow]No beaches found matching criteria.[/yellow]")
        return

    console.print(
        f"[bold]Crawling {len(beaches)} beaches in {state}...[/bold]"
    )

    asyncio.run(
        enrich_batch(
            beaches,
            concurrency=concurrency,
            skip_images=True,
            force_crawl=force,
            verbose=verbose,
        )
    )


@cli.command("find-images")
@click.argument("beach_query")
@click.pass_context
def find_images(ctx, beach_query):
    """Find CC-licensed images for a beach."""
    validate_config()
    from dataclasses import asdict

    from quiver_content.db.beaches import get_beach_with_gaps
    from quiver_content.images.discovery import discover_images
    from quiver_content.staging.manager import save_photo_candidates

    beach = _resolve(beach_query)
    beach_detail = get_beach_with_gaps(beach["id"])
    verbose = ctx.obj["verbose"]

    console.print(f"[bold]Finding images for {beach['name']}...[/bold]")

    candidates = asyncio.run(
        discover_images(
            beach_detail["name"],
            beach_detail["lat"],
            beach_detail["lon"],
            verbose=verbose,
        )
    )

    if not candidates:
        console.print("[yellow]No images found.[/yellow]")
        return

    candidate_dicts = [asdict(c) for c in candidates]
    path = save_photo_candidates(beach["id"], candidate_dicts)

    console.print(f"[green]Found {len(candidates)} image candidates[/green]")
    for i, c in enumerate(candidates[:5], 1):
        score_str = (
            f"[{'green' if c.score >= 0.5 else 'yellow'}]{c.score:.1f}[/]"
        )
        console.print(
            f"  {i}. {score_str} {c.title or 'Untitled'} ({c.source})"
        )
    if len(candidates) > 5:
        console.print(f"  [dim]... and {len(candidates) - 5} more[/dim]")
    console.print(f"[dim]Saved to: {path}[/dim]")


@cli.command("find-images-batch")
@click.option("--state", "-s", required=True, help="State code")
@click.option(
    "--city", "-c", multiple=True,
    help="Filter to specific city/cities (can repeat)"
)
@click.option(
    "--missing-only", is_flag=True, help="Only beaches without photos"
)
@click.option("--limit", "-l", type=int, default=50)
@click.option("--concurrency", type=int, default=3)
@click.pass_context
def find_images_batch(ctx, state, city, missing_only, limit, concurrency):
    """Find images for multiple beaches in a state."""
    validate_config()
    from quiver_content.db.beaches import get_beaches_with_gaps, list_beaches

    verbose = ctx.obj["verbose"]

    if missing_only:
        beaches = get_beaches_with_gaps(state=state)
    else:
        beaches = list_beaches(state=state)

    # Filter by city if specified
    if city:
        city_set = {c.lower() for c in city}
        beaches = [b for b in beaches if b.get("city", "").lower() in city_set]

    beaches = beaches[:limit]

    if not beaches:
        console.print("[yellow]No beaches found.[/yellow]")
        return

    console.print(
        f"[bold]Finding images for {len(beaches)} beaches in {state}...[/bold]"
    )

    async def _run():
        from dataclasses import asdict

        from quiver_content.images.discovery import discover_images
        from quiver_content.staging.manager import save_photo_candidates

        sem = asyncio.Semaphore(concurrency)
        success = 0
        errors = 0

        async def _find_one(beach):
            nonlocal success, errors
            async with sem:
                try:
                    candidates = await discover_images(
                        beach["name"],
                        beach["lat"],
                        beach["lon"],
                        verbose=verbose,
                    )
                    if candidates:
                        save_photo_candidates(
                            beach["id"], [asdict(c) for c in candidates]
                        )
                        console.print(
                            f"  [green]{beach['name']}[/green]: "
                            f"{len(candidates)} images"
                        )
                    else:
                        console.print(
                            f"  [dim]{beach['name']}: no images found[/dim]"
                        )
                    success += 1
                except Exception as e:
                    console.print(f"  [red]{beach['name']}: {e}[/red]")
                    errors += 1

        await asyncio.gather(*[_find_one(b) for b in beaches])
        console.print(
            f"\n[bold]Done![/bold] {success} success, {errors} errors"
        )

    asyncio.run(_run())


@cli.command()
@click.argument("beach_query")
@click.pass_context
def show(ctx, beach_query):
    """Display crawled content formatted for Claude Code.

    Prints the sources.md file content which can be pasted into a Claude Code
    conversation for editorial content generation.
    """
    validate_config()
    from quiver_content.config import STAGING_DIR

    beach = _resolve(beach_query)

    sources_path = STAGING_DIR / beach["id"] / "sources.md"
    if not sources_path.exists():
        console.print(
            f"[yellow]No crawled sources found for {beach['name']}.[/yellow]"
        )
        console.print(
            f'[dim]Run: quiver-content crawl "{beach["name"]}" first.[/dim]'
        )
        return

    # Print the sources.md content (designed for copy-paste into Claude Code)
    content = sources_path.read_text(encoding="utf-8")
    click.echo(content)


@cli.command()
@click.argument("beach_query")
@click.option(
    "--type",
    "content_type",
    required=True,
    help="Content type (e.g., beach_columns, beginner_notes)",
)
@click.option(
    "--file", "file_path", type=click.Path(exists=True), help="JSON file to stage"
)
@click.pass_context
def stage(ctx, beach_query, content_type, file_path):
    """Save generated JSON content to the staging area."""
    from quiver_content.staging.manager import save_content

    beach = _resolve(beach_query)

    if file_path:
        data = json.loads(Path(file_path).read_text())
    else:
        # Read from stdin
        console.print("[dim]Reading JSON from stdin...[/dim]")
        data = json.loads(sys.stdin.read())

    path = save_content(beach["id"], content_type, data)
    console.print(f"[green]Staged {content_type} for {beach['name']}[/green]")
    console.print(f"[dim]Saved to: {path}[/dim]")


@cli.command()
@click.argument("beach_query")
@click.pass_context
def review(ctx, beach_query):
    """Review staged content vs current database state."""
    validate_config()
    from quiver_content.db.beaches import get_beach_with_gaps
    from quiver_content.staging.manager import (
        list_staged,
        load_content,
        load_photo_candidates,
    )

    beach = _resolve(beach_query)
    beach_detail = get_beach_with_gaps(beach["id"])
    staged = list_staged(beach["id"])

    if not staged:
        console.print(f"[yellow]No staged content for {beach['name']}[/yellow]")
        return

    console.print(f"[bold]Staged content for {beach['name']}:[/bold]\n")

    for content_type in staged:
        data = load_content(beach["id"], content_type)
        if data is None:
            continue

        if content_type == "beach_columns":
            console.print("[cyan]Layer 1: Beach Columns[/cyan]")
            for key, value in data.items():
                # Show current vs staged
                current = beach_detail.get(key)
                status = (
                    "[green]NEW[/green]"
                    if current is None
                    else "[yellow]UPDATE[/yellow]"
                )
                # Truncate long values for display
                display_val = str(value)
                if len(display_val) > 80:
                    display_val = display_val[:77] + "..."
                console.print(f"  {status} {key}: {display_val}")
        else:
            console.print(f"[cyan]Layer 2: {content_type}[/cyan]")
            # Check if this content_type already exists in DB
            existing_types = [
                ec.get("content_type")
                for ec in beach_detail.get("editorial_content", [])
            ]
            if content_type in existing_types:
                console.print(
                    f"  [yellow]Will UPDATE existing {content_type}[/yellow]"
                )
            else:
                console.print(
                    f"  [green]Will CREATE new {content_type}[/green]"
                )
            # Show top-level keys
            if isinstance(data, dict):
                for key in data:
                    console.print(f"  - {key}")
        console.print()

    # Check for photo candidates too
    photos = load_photo_candidates(beach["id"])
    if photos:
        console.print(f"[cyan]Photos: {len(photos)} candidates[/cyan]")
        for p in photos[:3]:
            console.print(
                f"  - {p.get('title', 'Untitled')} ({p.get('source')}) "
                f"score={p.get('score', 0):.1f}"
            )
        if len(photos) > 3:
            console.print(f"  [dim]... and {len(photos) - 3} more[/dim]")


@cli.command()
@click.argument("beach_query")
@click.option("--photos", is_flag=True, help="Also publish photo candidates")
@click.option(
    "--dry-run", is_flag=True, help="Show what would be done without writing"
)
@click.pass_context
def publish(ctx, beach_query, photos, dry_run):
    """Publish staged content to Supabase."""
    validate_config()
    from quiver_content.staging.publisher import (
        publish_content,
        publish_photos as pub_photos,
    )

    beach = _resolve(beach_query)

    console.print(f"[bold]Publishing content for {beach['name']}...[/bold]")

    result = publish_content(beach["id"], dry_run=dry_run)

    if photos:
        pub_photos(beach["id"], dry_run=dry_run)

    # Warn about unstaged photos when --photos is not used
    if not photos:
        from quiver_content.staging.manager import load_photo_candidates

        candidates = load_photo_candidates(beach["id"])
        if candidates:
            console.print(
                f"[yellow]Note: {len(candidates)} photo candidates are staged but not published. "
                f"Use --photos to include them.[/yellow]"
            )

    if not dry_run and not result.get("errors"):
        console.print("\n[green bold]Published successfully![/green bold]")
    elif result.get("errors"):
        console.print(
            f"\n[red]Completed with {len(result['errors'])} errors[/red]"
        )


@cli.command()
@click.option("--state", "-s", required=True, help="State code")
@click.option("--limit", "-l", type=int, default=20, help="Max beaches")
@click.option(
    "--missing-only/--all",
    default=True,
    help="Process only beaches with gaps (default) or all beaches",
)
@click.option("--concurrency", type=int, default=3)
@click.option("--force", is_flag=True, help="Ignore cache")
@click.pass_context
def run(ctx, state, limit, missing_only, concurrency, force):
    """Full enrichment pipeline: crawl + images for multiple beaches."""
    validate_config()
    from quiver_content.db.beaches import get_beaches_with_gaps, list_beaches
    from quiver_content.pipeline.batch import enrich_batch

    verbose = ctx.obj["verbose"]

    if missing_only:
        beaches = get_beaches_with_gaps(state=state)
        beaches = [b for b in beaches if b.get("gap_count", 0) > 0]
    else:
        beaches = list_beaches(state=state)

    beaches = beaches[:limit]

    if not beaches:
        console.print("[yellow]No beaches found matching criteria.[/yellow]")
        return

    console.print(
        f"[bold]Running full pipeline for {len(beaches)} beaches "
        f"in {state}...[/bold]"
    )

    asyncio.run(
        enrich_batch(
            beaches,
            concurrency=concurrency,
            force_crawl=force,
            verbose=verbose,
        )
    )


if __name__ == "__main__":
    cli()
