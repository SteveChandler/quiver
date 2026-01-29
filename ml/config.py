"""Configuration for ML pipeline."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env.local first (production), then .env (local dev)
project_root = Path(__file__).parent.parent
load_dotenv(project_root / '.env.local')  # Production config
load_dotenv(project_root / '.env')  # Local dev fallback
load_dotenv()  # Also try ml/.env if exists

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
# Model configuration - combined model uses ERA5 augmented training + Open-Meteo features
MODEL_PATH = os.getenv("MODEL_PATH", "models/bias_model_combined_v1.json")
# Version history:
#   combined_v1: Initial ensemble model with NOAA + Open-Meteo
#   v2.1: Added large swell scaling to taper corrections for waves >1.5m
MODEL_VERSION = os.getenv("MODEL_VERSION", "v2.1")

# Large swell scaling thresholds (v2.1)
# Model trained primarily on small waves during flat spell, less reliable for large swells
# Linear taper: 100% correction below TAPER_START, 0% above TAPER_END
LARGE_SWELL_TAPER_START = float(os.getenv("LARGE_SWELL_TAPER_START", "1.5"))  # meters
LARGE_SWELL_TAPER_END = float(os.getenv("LARGE_SWELL_TAPER_END", "2.5"))      # meters

# Fallback model (NOAA-only) if Open-Meteo fetch fails or coordinates unavailable
FALLBACK_MODEL_PATH = os.getenv("FALLBACK_MODEL_PATH", "models/bias_model_v1.json")
USE_ENSEMBLE = os.getenv("USE_ENSEMBLE", "true").lower() == "true"

# Open-Meteo configuration
OPEN_METEO_TIMEOUT_MS = int(os.getenv("OPEN_METEO_TIMEOUT_MS", "2000"))
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET")

# Training config
MIN_TRAINING_SAMPLES = 1000
MAX_TIME_DIFF_SECONDS = 7200  # 2 hours


def validate_config():
    """Validate required configuration is present."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set")
