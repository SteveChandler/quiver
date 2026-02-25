"""Score image candidates for quality and relevance."""

from __future__ import annotations

from quiver_content.images.wikimedia import ImageCandidate

# Keywords that indicate the image is topically relevant to a beach/surf context
_RELEVANCE_KEYWORDS = {"surf", "wave", "beach", "ocean"}


def score_candidate(candidate: ImageCandidate, beach_name: str) -> float:
    """Score an image candidate on a 0.0-to-1.0 scale.

    Scoring criteria
    ----------------
    - Title contains beach name (case-insensitive):              +0.3
    - Title contains a relevance keyword:                        +0.2
    - Resolution >= 1920x1080:                                   +0.3
    - Landscape orientation (width > height) AND width >= 640:   +0.1
    - Has license_code (CC license verified):                    +0.1

    Parameters
    ----------
    candidate:
        The image candidate to score.
    beach_name:
        Name of the beach to match against the title.

    Returns
    -------
    float
        Score clamped to the range [0.0, 1.0].
    """
    score = 0.0
    title_lower = (candidate.title or "").lower()
    beach_lower = beach_name.lower()

    # Title contains beach name
    if beach_lower and beach_lower in title_lower:
        score += 0.3

    # Title contains a relevance keyword
    if any(kw in title_lower for kw in _RELEVANCE_KEYWORDS):
        score += 0.2

    w = candidate.width or 0
    h = candidate.height or 0

    # Resolution >= 1920x1080
    if w >= 1920 and h >= 1080:
        score += 0.3

    # Landscape bonus only for non-tiny images
    if w > h and w >= 640:
        score += 0.1

    # License verification bonus
    if candidate.license_code:
        score += 0.1

    return min(score, 1.0)


def rank_candidates(
    candidates: list[ImageCandidate],
    beach_name: str,
) -> list[ImageCandidate]:
    """Score and sort candidates by score descending.

    Mutates the ``score`` field on each candidate in-place, then returns the
    list sorted from highest to lowest score.
    """
    for c in candidates:
        c.score = score_candidate(c, beach_name)
    return sorted(candidates, key=lambda c: c.score, reverse=True)
