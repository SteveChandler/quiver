"""Single-beach enrichment: crawl sources, find images, write to staging."""

import asyncio
from dataclasses import asdict

from rich.console import Console

from quiver_content.config import ensure_dirs
from quiver_content.crawlers.base import CrawlCache
from quiver_content.crawlers.wikipedia import WikipediaCrawler
from quiver_content.crawlers.government import GovernmentCrawler
from quiver_content.images.discovery import discover_images
from quiver_content.staging.manager import save_sources, save_photo_candidates

console = Console()


async def enrich_beach(
    beach: dict,
    sources: list[str] | None = None,
    skip_images: bool = False,
    force_crawl: bool = False,
    verbose: bool = False,
) -> dict:
    """Run full enrichment pipeline for a single beach.

    Args:
        beach: Beach dict with keys: id, name, slug, city, state, lat, lon,
               plus gap info from get_beach_with_gaps()
        sources: Which crawlers to use. None = all. Options: ["wikipedia", "government"]
        skip_images: If True, skip image discovery
        force_crawl: If True, ignore cache
        verbose: Print progress

    Returns:
        dict with keys:
        - crawl_results: list of CrawlResult dicts
        - image_candidates: list of ImageCandidate dicts (empty if skip_images)
        - sources_path: Path to sources.md
        - photos_path: Path to candidates.json (None if skip_images)
        - errors: list of error strings
    """
    ensure_dirs()

    beach_id = beach["id"]
    beach_name = beach["name"]
    lat = beach.get("lat")
    lon = beach.get("lon")
    city = beach.get("city")
    state = beach.get("state")

    result = {
        "crawl_results": [],
        "image_candidates": [],
        "sources_path": None,
        "photos_path": None,
        "errors": [],
    }

    if lat is None or lon is None:
        result["errors"].append("Beach has no coordinates (lat/lon is null)")
        return result

    # Set up cache
    cache = CrawlCache() if not force_crawl else CrawlCache(ttl_days=0)

    # Determine which crawlers to use
    use_sources = sources or ["wikipedia", "government"]
    crawlers = []
    if "wikipedia" in use_sources:
        crawlers.append(WikipediaCrawler(cache=cache, verbose=verbose))
    if "government" in use_sources:
        crawlers.append(GovernmentCrawler(cache=cache, verbose=verbose))

    # Crawl all sources in parallel
    all_crawl_results = []

    async def _run_crawler(crawler):
        try:
            if verbose:
                console.print(f"[dim]Crawling with {crawler.__class__.__name__}...[/dim]")
            return await crawler.crawl(
                beach_name, lat, lon,
                city=city, state=state,
            )
        except Exception as e:
            error_msg = f"{crawler.__class__.__name__}: {e}"
            result["errors"].append(error_msg)
            if verbose:
                console.print(f"[red]Error: {error_msg}[/red]")
            return []

    crawler_results = await asyncio.gather(*[_run_crawler(c) for c in crawlers])
    for results_list in crawler_results:
        all_crawl_results.extend(results_list)

    # Save crawl results to staging
    crawl_dicts = [r.to_dict() for r in all_crawl_results]
    result["crawl_results"] = crawl_dicts

    if crawl_dicts or not skip_images:
        sources_path = save_sources(beach_id, beach, crawl_dicts)
        result["sources_path"] = str(sources_path)
        if verbose:
            console.print(f"[green]Saved sources.md to {sources_path}[/green]")

    # Find images
    if not skip_images:
        try:
            if verbose:
                console.print("[dim]Discovering images...[/dim]")
            candidates = await discover_images(beach_name, lat, lon, verbose=verbose)
            candidate_dicts = [asdict(c) for c in candidates] if candidates else []
            # Note: if candidates are already dicts (from some paths), handle that
            result["image_candidates"] = candidate_dicts

            if candidate_dicts:
                photos_path = save_photo_candidates(beach_id, candidate_dicts)
                result["photos_path"] = str(photos_path)
                if verbose:
                    console.print(f"[green]Saved {len(candidate_dicts)} image candidates[/green]")
        except Exception as e:
            error_msg = f"Image discovery: {e}"
            result["errors"].append(error_msg)
            if verbose:
                console.print(f"[red]Error: {error_msg}[/red]")

    return result
