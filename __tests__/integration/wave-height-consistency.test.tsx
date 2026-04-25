import { render } from "@testing-library/react";
import { WaveHeightDisplay } from "@/components/ui/wave-height-display";
import {
  formatWaveHeightRange,
} from "@/lib/services/discovery/surf-discovery-orchestrator";

/**
 * Wave-height divergence regression: city-list cards (driven by
 * `getBeachForecastPreview` → `WaveHeightDisplay`) and Oracle home / detail
 * surfaces (driven by `waveHeightBadge` → `WaveHeightDisplay`) must render
 * the same display string when fed the same underlying DB row.
 *
 * Both surfaces now flow through `WaveHeightDisplay` after this fix. The
 * test pins both code paths to the same fixture `enhanced_forecasts.wave_height`
 * value (rather than relying on each API's time-slice selection to land on
 * the same row — they may not) and asserts the final rendered string.
 *
 * Audit confirmed `enhanced_forecasts.wave_height` is canonical face-height
 * text ("<n> ft") across CDIP, NOAA_NWS, OPEN_METEO, and FALLBACK sources.
 */
describe("wave-height display consistency", () => {
  // Pinned fixture rows that mirror the audit output captured 2026-04-25
  // for OB Pier, La Jolla Shores, and Lower Trestles.
  const FIXTURES: Array<{ beach: string; wave_height: string }> = [
    { beach: "Ocean Beach Pier (CDIP 18:00 UTC)", wave_height: "1.4 ft" },
    { beach: "Ocean Beach Pier (NOAA_NWS 03:00 UTC)", wave_height: "2.7 ft" },
    { beach: "La Jolla Shores (CDIP 21:00 UTC)", wave_height: "3.5 ft" },
    { beach: "La Jolla Shores (NOAA_NWS 06:00 UTC)", wave_height: "3.7 ft" },
    { beach: "Lower Trestles (CDIP 18:00 UTC)", wave_height: "2.9 ft" },
    { beach: "Lower Trestles (NOAA_NWS 06:00 UTC)", wave_height: "1 ft" },
  ];

  function renderPreviewPath(rawWaveHeight: string): string {
    // Mirrors `getBeachForecastPreview` → `<ForecastPreview>` →
    // `<WaveHeightDisplay height={fp.wave_height} ... />`. The string is
    // passed through unchanged from the DB.
    const { container } = render(
      <WaveHeightDisplay height={rawWaveHeight} showTooltip={false} />,
    );
    return container.textContent?.trim() ?? "";
  }

  function renderDiscoveryPath(rawWaveHeight: string): string {
    // Mirrors `useSurfDiscovery` → orchestrator's `formatWaveHeightRange` →
    // `rec.waveHeightBadge` → `<WaveHeightDisplay height={rec.waveHeightBadge}
    // ... />`. The orchestrator parses the float out of the DB string and
    // brackets it via `formatWaveHeightRangeString`.
    const numeric = parseFloat(rawWaveHeight);
    const badge = formatWaveHeightRange(numeric);
    // Real call site uses `rec.waveHeightBadge ?? rec.forecast.wave_height`;
    // when waveHeightBadge is null (flat <0.5ft), the fallback is the raw
    // forecast string. Cover that case explicitly.
    const heightForDisplay = badge ?? rawWaveHeight;
    const { container } = render(
      <WaveHeightDisplay height={heightForDisplay} showTooltip={false} />,
    );
    return container.textContent?.trim() ?? "";
  }

  it.each(FIXTURES)(
    "preview and discovery paths render the same string for $beach",
    ({ wave_height }) => {
      const previewOut = renderPreviewPath(wave_height);
      const discoveryOut = renderDiscoveryPath(wave_height);
      expect(previewOut).toBe(discoveryOut);
      expect(previewOut).not.toBe("");
      expect(previewOut).not.toBe("--");
    },
  );

  it("renders '--' on both paths when wave_height is null", () => {
    // After removing the basic-`forecasts` fallback in
    // `getBeachForecastPreview`, an empty enhanced result returns null and
    // <WaveHeightDisplay height={null} /> renders "--". The discovery path
    // never selects a recommendation when forecast.wave_height is missing,
    // so the parallel-render assertion here is on the preview side only.
    const { container } = render(
      <WaveHeightDisplay height={null} showTooltip={false} />,
    );
    expect(container.textContent?.trim()).toBe("--");
  });
});
