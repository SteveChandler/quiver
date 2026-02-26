"""Base crawler ABC and shared data structures."""

from __future__ import annotations

import hashlib
import json
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

from quiver_content.config import CRAWL_CACHE_DIR, CRAWL_CACHE_TTL_DAYS


@dataclass
class CrawlImage:
    """An image found during crawling."""

    url: str
    title: str | None = None
    alt_text: str | None = None
    width: int | None = None
    height: int | None = None
    source: str | None = None  # e.g., "wikimedia", "wikipedia_article"
    license_code: str | None = None
    license_url: str | None = None
    creator_name: str | None = None
    creator_url: str | None = None


@dataclass
class CrawlResult:
    """Result from crawling a single URL."""

    source: str  # e.g., "wikipedia", "state_parks"
    url: str
    title: str | None = None
    raw_text: str = ""
    images: list[CrawlImage] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    crawled_at: float = field(default_factory=time.time)
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> CrawlResult:
        data = dict(data)  # shallow copy to avoid mutating caller's dict
        images = [CrawlImage(**img) for img in data.pop("images", [])]
        return cls(images=images, **data)


class CrawlCache:
    """Simple disk cache for crawl results keyed by URL hash."""

    def __init__(self, cache_dir: Path | None = None, ttl_days: int | None = None):
        self.cache_dir = cache_dir or CRAWL_CACHE_DIR
        self.ttl_days = ttl_days or CRAWL_CACHE_TTL_DAYS
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _key(self, url: str) -> str:
        return hashlib.sha256(url.encode()).hexdigest()[:32]

    def _path(self, url: str) -> Path:
        return self.cache_dir / f"{self._key(url)}.json"

    def get(self, url: str) -> CrawlResult | None:
        path = self._path(url)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text())
            age_days = (time.time() - float(data.get("crawled_at", 0))) / 86400
            if age_days > self.ttl_days:
                path.unlink(missing_ok=True)
                return None
            return CrawlResult.from_dict(data)
        except (json.JSONDecodeError, TypeError, ValueError, KeyError):
            # Corrupted cache entry -- remove and treat as miss
            path.unlink(missing_ok=True)
            return None

    def put(self, url: str, result: CrawlResult) -> None:
        path = self._path(url)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(result.to_dict(), default=str))
        tmp.rename(path)  # atomic on POSIX


class BaseCrawler(ABC):
    """Abstract base for all crawlers."""

    def __init__(self, cache: CrawlCache | None = None, verbose: bool = False):
        self.cache = cache or CrawlCache()
        self.verbose = verbose

    @abstractmethod
    async def crawl(
        self, beach_name: str, lat: float, lon: float, **kwargs
    ) -> list[CrawlResult]:
        """Crawl sources for a beach. Returns list of CrawlResult."""
        ...

    @staticmethod
    def _extract_markdown(response) -> str:
        """Extract raw markdown from a Crawl4AI response.

        Handles both Crawl4AI <0.8 (markdown_v2 attribute) and >=0.8
        (response.markdown is a MarkdownGenerationResult with .raw_markdown).
        """
        # Crawl4AI >=0.8: response.markdown is a MarkdownGenerationResult
        md = response.markdown
        if md is not None and hasattr(md, "raw_markdown"):
            return md.raw_markdown or ""
        # Crawl4AI <0.8: response.markdown is a plain string
        if isinstance(md, str):
            return md
        return ""

    def _log(self, msg: str) -> None:
        if self.verbose:
            from rich.console import Console

            Console(stderr=True).print(f"[dim]{msg}[/dim]")
