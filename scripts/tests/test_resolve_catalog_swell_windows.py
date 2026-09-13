import importlib.util
import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "resolve-catalog-swell-windows.py"


def load_module():
    spec = importlib.util.spec_from_file_location("catalog_resolution", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class CatalogResolutionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def test_wrapped_window_contains_directions(self):
        window = {"min_deg": 300, "max_deg": 45}
        self.assertTrue(self.module.direction_in_window(315, window))
        self.assertTrue(self.module.direction_in_window(15, window))
        self.assertFalse(self.module.direction_in_window(180, window))

    def test_window_span_handles_wrap(self):
        self.assertEqual(105, self.module.window_span({"min_deg": 300, "max_deg": 45}))
        self.assertEqual(120, self.module.window_span({"min_deg": 40, "max_deg": 160}))

    def test_nearly_full_circle_window_stays_full_with_tolerance(self):
        window = {"min_deg": 0, "max_deg": 355}
        self.assertTrue(self.module.direction_in_window(180, window))

    def test_identity_conflict_scope_blocks_production(self):
        evidence = {"source_scope": "claimed_identity_but_coordinate_conflict"}
        self.assertTrue(self.module.has_identity_conflict(evidence))

    def test_source_terrain_override_wins_for_wrapping_break(self):
        review = {
            "v1": {"window": {"min_deg": 40, "max_deg": 295}},
            "v2": {"window": {"min_deg": 140, "max_deg": 260}},
            "decision": {"status": "v2_supported_v1_rejected"},
        }
        evidence = {
            "directions_deg": [225, 270, 315],
            "selected_window_override": {"min_deg": 225, "max_deg": 315},
        }
        version, window, hits = self.module.choose_window(review, evidence)
        self.assertEqual("source_terrain_override", version)
        self.assertEqual({"min_deg": 225, "max_deg": 315}, window)
        self.assertEqual(3, hits["override"])

    def test_disposition_records_do_not_select_a_window(self):
        artifact = json.loads(
            (
                REPO_ROOT
                / "docs/imports/catalog-bathymetry/2026-08-28/catalog-source-bathymetry-resolution.json"
            ).read_text()
        )
        dispositions = [
            value
            for value in artifact["resolutions"].values()
            if value["production_action"] != "update_swell_window"
        ]
        self.assertEqual(2, len(dispositions))
        for disposition in dispositions:
            self.assertIsNone(disposition["selected_version"])
            self.assertIsNone(disposition["selected_window"])
            self.assertEqual("not_applicable", disposition["confidence"])
            self.assertFalse(disposition["production_update_allowed"])
            self.assertTrue(disposition["disposition_allowed"])

    def test_every_window_update_has_source_support(self):
        artifact = json.loads(
            (
                REPO_ROOT
                / "docs/imports/catalog-bathymetry/2026-08-28/catalog-source-bathymetry-resolution.json"
            ).read_text()
        )
        updates = [
            value
            for value in artifact["resolutions"].values()
            if value["production_action"] == "update_swell_window"
        ]
        self.assertEqual(126, len(updates))
        self.assertTrue(all(value["source_evidence"] for value in updates))
        self.assertTrue(all(value["selected_source_direction_hits"] > 0 for value in updates))
        self.assertTrue(all(value["production_update_allowed"] for value in updates))


if __name__ == "__main__":
    unittest.main()
