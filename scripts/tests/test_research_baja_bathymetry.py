import importlib.util
import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "research-baja-bathymetry.py"


def load_module():
    spec = importlib.util.spec_from_file_location("baja_bathymetry", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BajaBathymetryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def test_override_requires_refraction_type_sources_and_rationale(self):
        valid = self.module.WINDOW_OVERRIDES["bcs-punta-arenas"]
        self.module.validate_window_override("bcs-punta-arenas", valid)
        with self.assertRaises(ValueError):
            self.module.validate_window_override(
                "unknown",
                {"exception_type": "manual", "evidence_urls": ["one", "two"], "note": "reason"},
            )

    def test_artifact_distinguishes_direct_passes_from_wrap_exception(self):
        artifact = json.loads(
            (
                REPO_ROOT
                / "docs/imports/baja-surf-spots/2026-08-27/research/swell-window-bathymetry-audit.json"
            ).read_text()
        )
        self.assertEqual(111, artifact["summary"]["direct_grid_passes"])
        self.assertEqual(1, artifact["summary"]["documented_wrap_exceptions"])
        self.assertEqual(112, artifact["summary"]["medium_confidence"])
        punta_arenas = artifact["reviews"]["bcs-punta-arenas"]
        self.assertFalse(
            punta_arenas["model_agreement"]["passes_exposure_threshold"]
        )
        self.assertEqual(
            "south_wrap_window_narrowed_for_bathymetric_exposure",
            punta_arenas["status"],
        )


if __name__ == "__main__":
    unittest.main()
