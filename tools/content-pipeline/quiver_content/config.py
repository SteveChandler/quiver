"""Configuration for content pipeline. Mirrors ml/config.py env-loading pattern."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env.local first (production), then .env (local dev)
project_root = Path(__file__).parent.parent.parent.parent

# Verify we found the actual project root (should have package.json or .env.local)
if not (project_root / "package.json").exists():
    # Fallback: search upward for package.json
    candidate = Path(__file__).parent
    while candidate != candidate.parent:
        if (candidate / "package.json").exists():
            project_root = candidate
            break
        candidate = candidate.parent

load_dotenv(project_root / ".env.local")  # Production config
load_dotenv(project_root / ".env")  # Local dev fallback
load_dotenv()  # Also try CWD .env if exists

# Prefer NEXT_PUBLIC_SUPABASE_URL (.env.local / production) over
# SUPABASE_URL (.env / local dev) so the service_role key matches.
SUPABASE_URL = (
    os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    or os.getenv("SUPABASE_URL")
)
SUPABASE_SERVICE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Optional API keys
FLICKR_API_KEY = os.getenv("FLICKR_API_KEY")

# Crawling config
CRAWL_CACHE_TTL_DAYS = int(os.getenv("CRAWL_CACHE_TTL_DAYS", "7"))
CRAWL_RATE_LIMIT_RPM = int(os.getenv("CRAWL_RATE_LIMIT_RPM", "10"))
CRAWL_USER_AGENT = "QuiverContentBot/1.0 (+https://quiversurf.app)"

# Paths
OUTPUT_DIR = Path(__file__).parent.parent / "output"
CRAWL_CACHE_DIR = OUTPUT_DIR / "crawl_cache"
STAGING_DIR = OUTPUT_DIR / "staging"
REPORTS_DIR = OUTPUT_DIR / "reports"


def validate_config() -> None:
    """Validate required configuration is present."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n"
            "These are read from your project root .env.local automatically."
        )


def ensure_dirs() -> None:
    """Create output directories if they don't exist."""
    CRAWL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
