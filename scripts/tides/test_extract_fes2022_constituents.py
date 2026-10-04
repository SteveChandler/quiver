import lzma
import tempfile
import unittest
from pathlib import Path

import netCDF4
import numpy as np

from extract_fes2022_constituents import extract, pick_variable


class ExtractTests(unittest.TestCase):
    def test_grid_extraction(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, amplitude_name, phase_name, compressed in (
                ("m2", "amplitude", "phase", False),
                ("s2", "tide_height", "lag_degrees", True),
            ):
                filepath = root / f"{name}_fes2022.nc"
                with netCDF4.Dataset(filepath, "w") as dataset:
                    dataset.createDimension("lat", 10)
                    dataset.createDimension("lon", 4)
                    lat = dataset.createVariable("latitude", "f4", ("lat",))
                    lon = dataset.createVariable("longitude", "f4", ("lon",))
                    lat[:] = np.arange(10)
                    lon[:] = [0, 1, 2, 359]
                    amplitude = dataset.createVariable(amplitude_name, "f4", ("lat", "lon"), fill_value=-9999)
                    phase = dataset.createVariable(phase_name, "f4", ("lat", "lon"), fill_value=-9999)
                    amplitude.units = "cm"
                    phase.units = "degrees"
                    amplitude[:] = np.full((10, 4), np.nan)
                    phase[:] = np.full((10, 4), np.nan)
                    amplitude[1, 3] = 123 if name == "m2" else 45
                    phase[1, 3] = 210 if name == "m2" else 100
                if compressed:
                    with filepath.open("rb") as source, lzma.open(str(filepath) + ".xz", "wb") as target:
                        target.write(source.read())
                    filepath.unlink()
            result = extract(root, [
                {"id": "coast", "kind": "beach", "lat": 1, "lon": -0.2},
                {"id": "land", "kind": "beach", "lat": 9, "lon": 2},
            ])
            self.assertEqual(result["points"]["coast"]["cell"]["lon"], -1)
            self.assertEqual(result["points"]["coast"]["cell"]["lat"], 1)
            self.assertGreater(result["points"]["coast"]["cell"]["distanceKm"], 0)
            self.assertAlmostEqual(result["points"]["coast"]["constituents"][0]["amplitudeM"], 1.23, places=5)
            self.assertEqual(result["points"]["coast"]["constituents"][0]["phaseDeg"], 210)
            self.assertEqual([item["name"] for item in result["points"]["coast"]["constituents"]], ["M2", "S2"])
            self.assertAlmostEqual(result["points"]["coast"]["constituents"][1]["amplitudeM"], 0.45, places=5)
            self.assertEqual(result["unresolved"], ["land"])
            self.assertNotIn("land", result["points"])

    def test_ambiguous_variable_lists_available_names(self):
        with tempfile.TemporaryDirectory() as directory:
            filepath = Path(directory) / "m2_fes2022.nc"
            with netCDF4.Dataset(filepath, "w") as dataset:
                dataset.createDimension("lat", 1)
                dataset.createDimension("lon", 1)
                dataset.createVariable("lat", "f4", ("lat",))
                dataset.createVariable("lon", "f4", ("lon",))
                dataset.createVariable("amplitude", "f4", ("lat", "lon"))
                dataset.createVariable("amp", "f4", ("lat", "lon"))
                with self.assertRaisesRegex(ValueError, "available:.*amplitude.*amp"):
                    pick_variable(dataset, "amplitude")


if __name__ == "__main__":
    unittest.main()
