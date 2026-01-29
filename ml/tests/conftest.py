# ml/tests/conftest.py
"""Pytest configuration for ML tests."""
import sys
from pathlib import Path

# Add the ml directory to sys.path so imports work regardless of working directory
ml_dir = Path(__file__).parent.parent
if str(ml_dir) not in sys.path:
    sys.path.insert(0, str(ml_dir))
