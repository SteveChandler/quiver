import importlib.util
import pathlib
import sys
import types
import unittest
from unittest import mock


def _load_gsc_stats_module():
    google_module = types.ModuleType("google")
    oauth2_module = types.ModuleType("google.oauth2")
    service_account_module = types.ModuleType("google.oauth2.service_account")
    googleapiclient_module = types.ModuleType("googleapiclient")
    discovery_module = types.ModuleType("googleapiclient.discovery")
    discovery_module.build = lambda *args, **kwargs: None

    sys.modules.setdefault("google", google_module)
    sys.modules.setdefault("google.oauth2", oauth2_module)
    sys.modules.setdefault("google.oauth2.service_account", service_account_module)
    sys.modules.setdefault("googleapiclient", googleapiclient_module)
    sys.modules.setdefault("googleapiclient.discovery", discovery_module)

    module_path = pathlib.Path(__file__).resolve().parents[1] / "gsc-stats.py"
    spec = importlib.util.spec_from_file_location("gsc_stats_module", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


class GscStatsTests(unittest.TestCase):
    def test_inspect_indexing_maps_success_and_preserves_per_url_failures(self):
        gsc_stats = _load_gsc_stats_module()
        inspection_api = mock.Mock()
        inspection_api.index.return_value.inspect.return_value.execute.side_effect = [
            {
                "inspectionResult": {
                    "indexStatusResult": {
                        "verdict": "NEUTRAL",
                        "coverageState": "Discovered - currently not indexed",
                        "indexingState": "PASS",
                        "robotsTxtState": "ALLOWED",
                        "pageFetchState": "SUCCESSFUL",
                        "lastCrawlTime": "2026-07-14T01:02:03Z",
                        "sitemap": ["https://www.quiversurf.app/sitemap.xml", 123],
                        "referringUrls": ["https://www.quiversurf.app/", None],
                    }
                }
            },
            RuntimeError("inspection denied"),
        ]
        service = mock.Mock()
        service.urlInspection.return_value = inspection_api

        watchlist = [
            {"canonicalPath": "/beaches/mexico", "label": "Mexico location hub"},
            {"canonicalPath": "/beaches/mexico/baja-california", "label": None},
        ]
        with mock.patch.object(
            gsc_stats,
            "get_indexing_watchlist",
            return_value=(watchlist, ["watchlist warning"]),
        ):
            result = gsc_stats.inspect_indexing(service)

        self.assertEqual(result["missing"], ["watchlist warning"])
        self.assertEqual(result["results"][0], {
            "canonicalPath": "/beaches/mexico",
            "label": "Mexico location hub",
            "verdict": "NEUTRAL",
            "coverageState": "Discovered - currently not indexed",
            "indexingState": "PASS",
            "robotsTxtState": "ALLOWED",
            "pageFetchState": "SUCCESSFUL",
            "lastCrawlTime": "2026-07-14T01:02:03Z",
            "sitemap": ["https://www.quiversurf.app/sitemap.xml"],
            "referringUrls": ["https://www.quiversurf.app/"],
        })
        self.assertEqual(result["results"][1], {
            "canonicalPath": "/beaches/mexico/baja-california",
            "error": "inspection denied",
        })
        self.assertEqual(
            inspection_api.index.return_value.inspect.call_args_list,
            [
                mock.call(body={
                    "inspectionUrl": "https://www.quiversurf.app/beaches/mexico",
                    "siteUrl": "https://www.quiversurf.app/",
                }),
                mock.call(body={
                    "inspectionUrl": "https://www.quiversurf.app/beaches/mexico/baja-california",
                    "siteUrl": "https://www.quiversurf.app/",
                }),
            ],
        )

    def test_build_json_export_writes_partial_when_sitemap_fails(self):
        gsc_stats = _load_gsc_stats_module()

        def _raise_sitemap(_service):
            raise RuntimeError("dns lookup failed")

        def _query_stub(_service, _start, _end, dimensions, row_limit=25000):
            if dimensions == ["page"]:
                return [{
                    "keys": ["https://www.quiversurf.app/"],
                    "clicks": 1,
                    "impressions": 10,
                    "ctr": 0.1,
                    "position": 3.2,
                }]
            if dimensions == ["query"]:
                return [{
                    "keys": ["surf forecast"],
                    "clicks": 2,
                    "impressions": 20,
                    "ctr": 0.1,
                    "position": 4.1,
                }]
            if dimensions == ["device"]:
                return [{
                    "keys": ["mobile"],
                    "clicks": 2,
                    "impressions": 20,
                    "ctr": 0.1,
                    "position": 4.1,
                }]
            if dimensions == ["country"]:
                return [{
                    "keys": ["us"],
                    "clicks": 2,
                    "impressions": 20,
                    "ctr": 0.1,
                    "position": 4.1,
                }]
            return []

        with (
            mock.patch.object(gsc_stats, "get_sitemap_comparison", side_effect=_raise_sitemap),
            mock.patch.object(gsc_stats, "query_gsc", side_effect=_query_stub),
            mock.patch.object(gsc_stats, "get_top_queries", return_value=_query_stub(None, "", "", ["query"])),
            mock.patch.object(gsc_stats, "get_top_pages", return_value=_query_stub(None, "", "", ["page"])),
            mock.patch.object(gsc_stats, "get_by_device", return_value=_query_stub(None, "", "", ["device"])),
            mock.patch.object(gsc_stats, "get_by_country", return_value=_query_stub(None, "", "", ["country"])),
        ):
            export = gsc_stats.build_json_export(object())

        self.assertIsInstance(export, dict)
        self.assertIn("missing", export)
        self.assertTrue(any("Sitemap comparison unavailable" in item for item in export["missing"]))
        self.assertTrue(export["last7d"])
        self.assertTrue(export["topQueries"])


if __name__ == "__main__":
    unittest.main()
