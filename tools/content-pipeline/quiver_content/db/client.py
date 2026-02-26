"""Supabase service_role client for content pipeline."""

from supabase import create_client, Client
from quiver_content.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, validate_config

_client: Client | None = None


def get_client() -> Client:
    """Get or create a singleton Supabase client using service_role key."""
    global _client
    if _client is None:
        validate_config()
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client
