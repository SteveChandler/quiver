"""Orchestrate image search across all configured sources."""

from __future__ import annotations

import asyncio
import logging

from quiver_content.images.flickr import search_flickr
from quiver_content.images.scorer import rank_candidates
from quiver_content.images.wikimedia import ImageCandidate, search_wikimedia

logger = logging.getLogger(__name__)


async def discover_images(
    beach_name: str,
    lat: float,
    lon: float,
    verbose: bool = False,
) -> list[ImageCandidate]:
    """Search all configured image sources and return ranked candidates.

    Runs Wikimedia Commons and Flickr searches in parallel, combines the
    results, scores them, and returns a single list sorted by relevance.

    Parameters
    ----------
    beach_name:
        Name of the beach (used for search queries and scoring).
    lat, lon:
        Coordinates of the beach.
    verbose:
        When True, log progress and result counts to stderr.

    Returns
    -------
    list[ImageCandidate]
        All candidates from every source, ranked by score descending.
    """
    if verbose:
        logger.info(
            "Discovering images for %s (%.4f, %.4f)", beach_name, lat, lon
        )

    wikimedia_results, flickr_results = await asyncio.gather(
        search_wikimedia(beach_name, lat, lon),
        search_flickr(beach_name, lat, lon),
    )

    if verbose:
        logger.info(
            "Found %d Wikimedia + %d Flickr candidates for %s",
            len(wikimedia_results),
            len(flickr_results),
            beach_name,
        )

    all_candidates: list[ImageCandidate] = wikimedia_results + flickr_results

    if not all_candidates:
        return []

    ranked = rank_candidates(all_candidates, beach_name)

    if verbose:
        top = ranked[:3]
        for c in top:
            logger.info(
                "  %.2f  %s  %s", c.score, c.source, c.title or "(untitled)"
            )

    return ranked
