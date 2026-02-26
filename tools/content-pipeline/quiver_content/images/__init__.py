"""Image discovery and scoring for beach photos."""

from quiver_content.images.discovery import discover_images
from quiver_content.images.flickr import search_flickr
from quiver_content.images.license import build_attribution_html
from quiver_content.images.scorer import rank_candidates, score_candidate
from quiver_content.images.wikimedia import ImageCandidate, search_wikimedia

__all__ = [
    "ImageCandidate",
    "build_attribution_html",
    "discover_images",
    "rank_candidates",
    "score_candidate",
    "search_flickr",
    "search_wikimedia",
]
