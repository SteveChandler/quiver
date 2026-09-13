import importlib.util
import unittest
from unittest.mock import patch
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "fetch-catalog-surf-guide-evidence.py"


def load_module():
    spec = importlib.util.spec_from_file_location("surf_guide_evidence", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SurfGuideEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def test_compass_phrase_conversion(self):
        self.assertEqual(292.5, self.module.compass_degrees("west northwest"))
        self.assertEqual(202.5, self.module.compass_degrees("south southwest"))
        self.assertEqual(45, self.module.compass_degrees("northeast"))

    def test_parse_page_extracts_coordinate_and_direction(self):
        html = """
        <script>{"currentLocation":{"name":"Example","filename":"Example","lat":37.5,"lng":-122.5}}</script>
        <p>The ideal swell direction is from the west northwest. Primarily a reef break.</p>
        """
        parsed = self.module.parse_page(html)
        self.assertEqual({"latitude": 37.5, "longitude": -122.5}, parsed["coordinate"])
        self.assertEqual("west northwest", parsed["ideal_direction_text"])
        self.assertEqual(292.5, parsed["ideal_direction_deg"])

    def test_normalized_name_ignores_punctuation_and_descriptors(self):
        self.assertEqual("marias", self.module.normalize_name("María's"))
        self.assertEqual("new smyrna beach", self.module.normalize_name("New Smyrna Beach (NSB) Inlet"))

    def test_empty_sitemap_falls_back_to_country_break_indexes(self):
        sitemap = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
        country = '<a href="/breaks/Mavericks">Mavericks</a>'
        with patch.object(self.module, "fetch_text", side_effect=[sitemap, country, country]):
            self.assertEqual(
                ["https://www.surf-forecast.com/breaks/Mavericks"],
                self.module.sitemap_urls(),
            )


if __name__ == "__main__":
    unittest.main()
