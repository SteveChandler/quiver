import importlib.util
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "research-catalog-bathymetry.py"


def load_module():
    spec = importlib.util.spec_from_file_location("catalog_bathymetry", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class CatalogBathymetryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def test_split_sql_values_preserves_nested_commas(self):
        values = self.module.split_sql_values(
            "'Beach, North', ARRAY['reef', 'rocks']::text[], '{\"a\":1,\"b\":2}'::jsonb, 270"
        )
        self.assertEqual(4, len(values))
        self.assertEqual("'Beach, North'", values[0])
        self.assertEqual("270", values[3])

    def test_catalog_target_partition_matches_snapshot(self):
        rows = self.module.load_catalog(
            REPO_ROOT / "supabase" / "snapshots" / "catalog.sql"
        )
        targets = self.module.derive_catalog_targets(rows)
        missing = [row for row in targets if "missing_v2" in row["audit_reasons"]]
        divergent = [
            row for row in targets if "material_v1_v2_divergence" in row["audit_reasons"]
        ]

        self.assertEqual(346, len(rows))
        self.assertEqual(25, len(missing))
        self.assertEqual(103, len(divergent))
        self.assertEqual(128, len(targets))
        self.assertFalse(
            set(row["id"] for row in missing)
            & set(row["id"] for row in divergent)
        )

    def test_region_routing_separates_baja_from_northeast(self):
        self.assertEqual(
            "baja",
            self.module.catalog_region(
                {"country": "Mexico", "state": "Baja California"}
            ),
        )
        self.assertEqual(
            "northeast",
            self.module.catalog_region({"country": "USA", "state": "NY"}),
        )

    def test_material_divergence_uses_circular_endpoints(self):
        self.assertTrue(self.module.is_material_divergence(5, 285, 155, 255))
        self.assertFalse(self.module.is_material_divergence(220, 340, 185, 315))

    def test_every_catalog_target_requires_source_research(self):
        decision = self.module.decision_for(
            {"audit_reasons": ["missing_v2"], "break_type": "beach"},
            {"window": {"min_deg": 90, "max_deg": 180}, "model_agreement": {"passes_exposure_threshold": True}},
            None,
        )
        self.assertTrue(decision["source_research_required"])


if __name__ == "__main__":
    unittest.main()
