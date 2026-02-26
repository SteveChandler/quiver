"""Batch beach enrichment with concurrency control and error isolation."""

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskID
from rich.table import Table

from quiver_content.config import REPORTS_DIR, ensure_dirs
from quiver_content.pipeline.enrich import enrich_beach

console = Console()


async def enrich_batch(
    beaches: list[dict],
    concurrency: int = 3,
    sources: list[str] | None = None,
    skip_images: bool = False,
    force_crawl: bool = False,
    verbose: bool = False,
) -> dict:
    """Enrich multiple beaches with concurrency control.

    Args:
        beaches: List of beach dicts from get_beaches_with_gaps()
        concurrency: Max concurrent enrichments (default 3)
        sources: Which crawlers to use (None = all)
        skip_images: Skip image discovery
        force_crawl: Ignore cache
        verbose: Print detailed progress

    Returns:
        Batch report dict with per-beach results and summary
    """
    ensure_dirs()

    semaphore = asyncio.Semaphore(concurrency)
    results = {}

    async def _enrich_one(beach: dict) -> tuple[str, dict]:
        async with semaphore:
            beach_id = beach["id"]
            beach_name = beach["name"]
            try:
                result = await enrich_beach(
                    beach,
                    sources=sources,
                    skip_images=skip_images,
                    force_crawl=force_crawl,
                    verbose=verbose,
                )
                return beach_id, {
                    "name": beach_name,
                    "status": "error" if result["errors"] else "success",
                    **result,
                }
            except Exception as e:
                return beach_id, {
                    "name": beach_name,
                    "status": "error",
                    "errors": [str(e)],
                    "crawl_results": [],
                    "image_candidates": [],
                }

    # Run with progress bar
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TextColumn("({task.completed}/{task.total})"),
        console=console,
    ) as progress:
        task = progress.add_task("Enriching beaches...", total=len(beaches))

        tasks = [_enrich_one(beach) for beach in beaches]
        for coro in asyncio.as_completed(tasks):
            beach_id, result = await coro
            results[beach_id] = result
            progress.advance(task)

    # Build summary
    success_count = sum(1 for r in results.values() if r["status"] == "success")
    error_count = sum(1 for r in results.values() if r["status"] == "error")
    total_sources = sum(len(r.get("crawl_results", [])) for r in results.values())
    total_images = sum(len(r.get("image_candidates", [])) for r in results.values())

    now = datetime.now(timezone.utc)
    report = {
        "timestamp": now.isoformat(),
        "total": len(beaches),
        "success": success_count,
        "errors": error_count,
        "total_sources_crawled": total_sources,
        "total_images_found": total_images,
        "beaches": results,
    }

    # Save report
    report_path = REPORTS_DIR / f"batch_{now.strftime('%Y%m%d_%H%M%S')}.json"
    report_path.write_text(json.dumps(report, indent=2, default=str))

    # Print summary table
    _print_summary(report, report_path)

    return report


def _print_summary(report: dict, report_path: Path) -> None:
    """Print a rich summary table of batch results."""
    table = Table(title="Batch Enrichment Report")
    table.add_column("Beach", style="cyan")
    table.add_column("Status", style="bold")
    table.add_column("Sources", justify="right")
    table.add_column("Images", justify="right")
    table.add_column("Errors", style="red")

    for beach_id, info in report["beaches"].items():
        status_style = "green" if info["status"] == "success" else "red"
        errors = ", ".join(info.get("errors", [])) or "-"
        table.add_row(
            info["name"],
            f"[{status_style}]{info['status']}[/{status_style}]",
            str(len(info.get("crawl_results", []))),
            str(len(info.get("image_candidates", []))),
            errors if errors != "-" else "[dim]-[/dim]",
        )

    console.print()
    console.print(table)
    console.print()
    console.print(f"[bold]Total:[/bold] {report['total']} beaches | "
                  f"[green]{report['success']} success[/green] | "
                  f"[red]{report['errors']} errors[/red] | "
                  f"{report['total_sources_crawled']} sources | "
                  f"{report['total_images_found']} images")
    console.print(f"[dim]Report saved to {report_path}[/dim]")
