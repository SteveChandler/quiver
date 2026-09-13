import importlib.util
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "fetch-catalog-surfspots-evidence.py"


def load_module():
    spec = importlib.util.spec_from_file_location("surfspots_evidence", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SurfSpotsEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def test_parse_page_extracts_coordinate_and_directions(self):
        html = (
            '<title>Marine Street (shorebreak) - SurfSpots.co</title>'
            '"latitude":"32.83685042","longitude":"-117.28087664",'
            '"swell_dir":["NorthWest","West","SouthWest"]'
        )
        parsed = self.module.parse_page(html)
        self.assertEqual(
            {"latitude": 32.83685042, "longitude": -117.28087664},
            parsed["coordinate"],
        )
        self.assertEqual([315.0, 270.0, 225.0], parsed["ideal_direction_deg"])

    def test_camel_case_compass_conversion(self):
        self.assertEqual(292.5, self.module.compass_degrees("WestNorthWest"))
        self.assertEqual(157.5, self.module.compass_degrees("SouthSouthEast"))

    def test_primary_match_requires_nearby_shared_name_token(self):
        review = {"name": "Marine Street Beach"}
        wrong_neighbor = {
            "status": "coordinate_and_direction_matched",
            "distance_km": 3,
            "name_score": 0.8,
            "source_url": "https://www.surf-forecast.com/breaks/Torrey-Pines-State-Beach",
        }
        exact = {**wrong_neighbor, "source_url": "https://www.surf-forecast.com/breaks/Marine-Street"}
        self.assertFalse(self.module.primary_match_is_trusted(review, wrong_neighbor))
        self.assertTrue(self.module.primary_match_is_trusted(review, exact))

        pops = {**wrong_neighbor, "name_score": 0.667, "source_url": "https://www.surf-forecast.com/breaks/Populars"}
        self.assertTrue(self.module.primary_match_is_trusted({"name": "Pops"}, pops))

        misspelled = {**wrong_neighbor, "distance_km": 8, "name_score": 0.96, "source_url": "https://www.surf-forecast.com/breaks/Doheney-Beach"}
        self.assertTrue(self.module.primary_match_is_trusted({"name": "Doheny Beach"}, misspelled))

        near_variant = {**wrong_neighbor, "distance_km": 0.4, "name_score": 0.857, "source_url": "https://www.surf-forecast.com/breaks/Banyons"}
        self.assertTrue(self.module.primary_match_is_trusted({"name": "Banyans"}, near_variant))

    def test_neighboring_subbreak_does_not_count_as_exact_match(self):
        result = {
            "status": "coordinate_and_direction_matched",
            "distance_km": 1,
            "name_score": 0.8,
            "source_url": "https://www.surf-forecast.com/breaks/Westport_The-Groins",
        }
        self.assertFalse(
            self.module.primary_match_is_trusted(
                {"name": "Westport – The Jetty"}, result
            )
        )

        for target, source in [
            ("Ocean Beach SF – Middle", "Ocean-Beach"),
            ("Ocean Beach SF – Sloat", "Ocean-Beach"),
            ("Rockaway Beach – 90th St", "Rockaway_1"),
            ("Pleasure Point", "Pleasure-Point-Sewer-Peak"),
            ("Huntington St.", "Huntington-Pier"),
        ]:
            self.assertFalse(
                self.module.primary_match_is_trusted(
                    {"name": target},
                    {**result, "name_score": 0.95, "source_url": f"https://www.surf-forecast.com/breaks/{source}"},
                )
            )

    def test_secondary_provider_uses_same_qualifier_gate(self):
        result = {
            "status": "coordinate_name_and_direction_matched",
            "distance_km": 1,
            "name_score": 0.95,
            "source_url": "https://www.surfspots.co/spot/ocean-shores",
        }
        self.assertFalse(
            self.module.secondary_match_is_trusted(
                {"name": "Ocean Shores / North Beaches"}, result
            )
        )
        self.assertTrue(
            self.module.secondary_match_is_trusted(
                {"name": "Ocean Shores"}, result
            )
        )
        self.assertFalse(
            self.module.primary_match_is_trusted(
                {"name": "La Push – Third Beach"},
                {**result, "source_url": "https://www.surf-forecast.com/breaks/La-Push"},
            )
        )


if __name__ == "__main__":
    unittest.main()
