# Costa Viva Direct Feed Memo

Date: 2026-07-02

Scope: document non-camera feeds Quiver may source later. No tide, wave, weather, wind, forecast, or ingestion code is changed in this pass.

## What Costa Viva Appears To Use

The public Costa Viva bundle and `llms.txt` indicate a simple direct-feed stack:

| Feed area | Upstream name | Costa Viva observed use | Observed request shape |
|---|---|---|---|
| Tides | NOAA CO-OPS Data API | Per-location tide predictions using mapped CO-OPS station IDs. Costa uses high/low predictions, MLLW, English units, local time with daylight adjustment. | `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=CostaViva&begin_date=${start}&end_date=${end}&datum=MLLW&station=${stationId}&time_zone=lst_ldt&units=english&interval=hilo&format=json` |
| Wave/marine | Open-Meteo Marine Weather API | Current mean wave and swell fields for each location. Costa asks for wave height, period, direction, swell height, swell period, and swell direction. | `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction&length_unit=metric&timezone=America%2FNew_York` |
| Weather/wind | Open-Meteo Weather Forecast API | Current weather card plus short precipitation/UV context. Costa asks for 2m temperature, apparent temperature, 10m wind speed/direction, UV, hourly precipitation/probability, and daily max UV. | `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,uv_index&hourly=precipitation,precipitation_probability&daily=uv_index_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York&forecast_days=1` |

## Source Notes

- NOAA CO-OPS is the right direct upstream for U.S. tide predictions. The CO-OPS API supports station-based `product=predictions`, `datum=MLLW`, `units=english`, `time_zone=lst_ldt`, and `interval=hilo`.
- Open-Meteo Marine provides wave and swell variables directly by coordinate. It is useful for quick display, but Quiver should compare its coastal resolution and bias against Quiver's existing surf/ML pipeline before using it for scoring.
- Open-Meteo Forecast provides the current wind/weather fields Costa uses. For U.S. locations, Open-Meteo's default model selection may include NOAA models such as GFS/HRRR, but it is still an aggregator API and should not be treated as original station data.

Reference docs:

- Costa Viva AI/source summary: https://costaviva.app/llms.txt
- NOAA CO-OPS Data API: https://api.tidesandcurrents.noaa.gov/api/prod/
- Open-Meteo Marine Weather API: https://open-meteo.com/en/docs/marine-weather-api
- Open-Meteo Weather Forecast API: https://open-meteo.com/en/docs

## Later Quiver Sourcing Plan

1. Tides: map Quiver NJ beach rows to NOAA CO-OPS station IDs, then decide whether to store high/low tide snapshots or query on demand. Reuse `forecast_at`-style timestamp discipline if persisted.
2. Wave/marine: evaluate Open-Meteo Marine as a supplemental display feed only after comparing against Quiver's existing forecast fields for the same beaches and times.
3. Weather/wind: evaluate Open-Meteo current wind/weather as a UI convenience feed, not as a replacement for Quiver's forecast ingestion.

## Explicit Non-Goals For This Pass

- Do not change forecast ingestion.
- Do not add tide, wave, weather, or wind tables.
- Do not change scoring, alerting, or ML inputs.
- Do not promote Costa Viva's source choices to source-of-truth status without Quiver-side validation.
