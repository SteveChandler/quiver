# ml/tests/test_parsing.py
import pytest
from ml.parsing import parse_wave_height, parse_wind_speed

class TestParseWaveHeight:
    def test_range_format(self):
        assert parse_wave_height("3-4ft") == pytest.approx(1.07, rel=0.01)

    def test_range_with_spaces(self):
        assert parse_wave_height("3 to 4 ft") == pytest.approx(1.07, rel=0.01)

    def test_range_with_plus(self):
        assert parse_wave_height("3-4 ft plus") == pytest.approx(1.07, rel=0.01)

    def test_single_value(self):
        assert parse_wave_height("3ft") == pytest.approx(0.91, rel=0.01)

    def test_flat(self):
        assert parse_wave_height("Flat") == 0.15
        assert parse_wave_height("flat") == 0.15

    def test_none_input(self):
        assert parse_wave_height(None) == 0.15

    def test_empty_string(self):
        assert parse_wave_height("") == 0.15

    def test_unparseable(self):
        assert parse_wave_height("unknown") is None

class TestParseWindSpeed:
    def test_mph_format(self):
        assert parse_wind_speed("10 mph") == pytest.approx(4.47, rel=0.01)

    def test_kts_format(self):
        assert parse_wind_speed("10 kts") == pytest.approx(5.14, rel=0.01)

    def test_none_input(self):
        assert parse_wind_speed(None) is None

    def test_mph_no_space(self):
        assert parse_wind_speed("10mph") == pytest.approx(4.47, rel=0.01)

    def test_knots_format(self):
        assert parse_wind_speed("10 knots") == pytest.approx(5.14, rel=0.01)

    def test_empty_string(self):
        assert parse_wind_speed("") is None

    def test_no_unit_assumes_ms(self):
        assert parse_wind_speed("10") == 10.0

    def test_unparseable(self):
        assert parse_wind_speed("gusty") is None
