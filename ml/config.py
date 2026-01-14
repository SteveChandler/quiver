"""Configuration for ML pipeline."""
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
MODEL_PATH = os.getenv("MODEL_PATH", "models/bias_model_v1.json")
MODEL_VERSION = os.getenv("MODEL_VERSION", "v1")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET")

# Training config
MIN_TRAINING_SAMPLES = 1000
MAX_TIME_DIFF_SECONDS = 7200  # 2 hours
