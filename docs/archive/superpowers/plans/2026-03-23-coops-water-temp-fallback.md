# CO-OPS Water Temperature Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NOAA CO-OPS water temperature as a fallback data source so beaches without IOOS buoy coverage get real observed temperatures instead of flat-line latitude estimates.

**Architecture:** Add `fetchWaterTemperature()` to the existing CO-OPS API client, wire it into `EnhancedForecastService` as a parallel fetch, and thread the result into `ForecastBuilder.getWaterTemperature()` as Priority 2 (IOOS → CO-OPS → latitude estimation).

**Tech Stack:** TypeScript, NOAA CO-OPS API, Next.js, Jest

**Spec:** `docs/archive/superpowers/specs/2026-03-23-coops-water-temp-fallback-design.md`

---

### Task 1: Add `fetchWaterTemperature()` to CO-OPS API client

**Files:**
- Modify: `lib/services/noaa-coops/api-client.ts:65-102` (add URL builder + fetch function after `buildWaterLevelUrl`)
- Test: `__tests__/lib/services/noaa-coops/api-client.test.ts` (new file)

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/services/noaa-coops/api-client.test.ts`:

```typescript
import { fetchWaterTemperature } from "@/lib/services/noaa-coops/api-client";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("fetchWaterTemperature", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns tempC and observedAt from valid CO-OPS response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        metadata: { id: "8720218", name: "Mayport" },
        data: [
          { t: "2026-03-23 14:00", v: "17.6", f: "0,0,0" },
          { t: "2026-03-23 15:12", v: "17.8", f: "0,0,0" },
        ],
      }),
    });

    const result = await fetchWaterTemperature("8720218");

    expect(result).not.toBeNull();
    expect(result!.tempC).toBeCloseTo(17.8);
    expect(result!.observedAt).toBe("2026-03-23T15:12Z");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("product=water_temperature"),
      expect.any(Object)
    );
  });

  it("returns null when station has no water temp data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        error: { message: "No data was found." },
      }),
    });

    const result = await fetchWaterTemperature("8720587");
    expect(result).toBeNull();
  });

  it("returns null when data array is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        metadata: { id: "8720218" },
        data: [],
      }),
    });

    const result = await fetchWaterTemperature("8720218");
    expect(result).toBeNull();
  });

  it("returns null on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await fetchWaterTemperature("8720218");
    expect(result).toBeNull();
  });

  it("returns null on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchWaterTemperature("8720218");
    expect(result).toBeNull();
  });

  it("returns null when temperature value is non-numeric", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        metadata: { id: "8720218" },
        data: [{ t: "2026-03-23 15:12", v: "", f: "0,0,0" }],
      }),
    });

    const result = await fetchWaterTemperature("8720218");
    expect(result).toBeNull();
  });

  it("uses metric units and GMT timezone", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await fetchWaterTemperature("8720218");

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("units=metric");
    expect(calledUrl).toContain("time_zone=gmt");
    expect(calledUrl).toContain("range=24");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/services/noaa-coops/api-client.test.ts --no-coverage`
Expected: FAIL — `fetchWaterTemperature` is not exported from `api-client.ts`

- [ ] **Step 3: Implement `fetchWaterTemperature`**

Add to `lib/services/noaa-coops/api-client.ts` after the `buildWaterLevelUrl` function (after line 81):

```typescript
/**
 * Build the CO-OPS API URL for water temperature
 */
function buildWaterTemperatureUrl(stationId: string): string {
  const url = new URL(COOPS_BASE_URL);
  url.searchParams.set("application", "quiver-surf-app");
  url.searchParams.set("station", stationId);
  url.searchParams.set("range", "24"); // Last 24 hours
  url.searchParams.set("product", "water_temperature");
  url.searchParams.set("units", "metric");
  url.searchParams.set("time_zone", "gmt");
  url.searchParams.set("format", "json");
  return url.toString();
}
```

Add the fetch function after `fetchCurrentWaterLevel` (after line 216), and add it to the exports:

```typescript
/**
 * Fetch latest water temperature from CO-OPS API
 *
 * Returns the most recent reading from the last 24 hours.
 * Silent failure — returns null on any error.
 *
 * @param stationId - CO-OPS station ID (e.g., "8720218")
 * @returns Temperature in Celsius with observation timestamp, or null
 */
export async function fetchWaterTemperature(
  stationId: string
): Promise<{ tempC: number; observedAt: string } | null> {
  try {
    const url = buildWaterTemperatureUrl(stationId);
    const timeoutSignal = createTimeoutSignal(OPTIONAL_REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    // Use the most recent reading
    const latest = data.data[data.data.length - 1];
    const tempC = parseFloat(latest.v);

    if (!isFinite(tempC)) {
      return null;
    }

    // CO-OPS timestamps are GMT but lack timezone indicator — append Z for UTC
    const observedAt = latest.t.replace(" ", "T") + "Z";

    return { tempC, observedAt };
  } catch {
    // Silent failure — water temperature is optional enhancement
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/services/noaa-coops/api-client.test.ts --no-coverage`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/noaa-coops/api-client.ts __tests__/lib/services/noaa-coops/api-client.test.ts
git commit -m "feat: add fetchWaterTemperature to CO-OPS API client

Adds water_temperature product support to the existing NOAA CO-OPS
API client. Returns latest reading from the past 24 hours in Celsius.
Silent failure mirrors existing fetchCurrentWaterLevel pattern."
```

---

### Task 2: Wire CO-OPS water temp into forecast generation

**Files:**
- Modify: `lib/services/enhanced-forecast-service.ts:88-132` (add fetch + thread to builder)
- Modify: `lib/services/forecast/forecast-builder.ts:53-61, 80-81, 145-157, 168-205, 598-617` (add `coopsWaterTempC` throughout)

- [ ] **Step 1: Update `ForecastInputs` interface**

In `lib/services/forecast/forecast-builder.ts`, add `coopsWaterTempC` to the `ForecastInputs` interface (line 60):

```typescript
export interface ForecastInputs {
  beach: Beach;
  waveData: WaveWatchForecast | null;
  tideData: COOPSForecast | null;
  weatherData: WeatherPeriod[];
  buoyData: NDBCBuoyRow | null;
  cdipData: CDIPBuoyData | null;
  ioosWaterTempC: number | null;
  coopsWaterTempC: number | null;
}
```

- [ ] **Step 2: Thread `coopsWaterTempC` through `buildForecasts` and `buildSingleForecast`**

In `buildForecasts` (line 81), destructure the new field:

```typescript
const { beach, waveData, tideData, weatherData, buoyData, cdipData, ioosWaterTempC, coopsWaterTempC } = inputs;
```

In the `buildSingleForecast` call (line ~156), add:

```typescript
        coopsWaterTempC,
```

In `buildSingleForecast` params type (line ~185), add:

```typescript
    coopsWaterTempC: number | null;
```

In the destructuring inside `buildSingleForecast` (line ~204), add:

```typescript
      coopsWaterTempC,
```

Update the `water_temp` line (line 233) to pass the new param:

```typescript
      water_temp: this.getWaterTemperature(buoyData, beach, forecastTime, ioosWaterTempC, coopsWaterTempC),
```

- [ ] **Step 3: Update `getWaterTemperature` fallback chain**

Update the method signature and add CO-OPS as Priority 2 (line 598):

```typescript
  private getWaterTemperature(
    buoyData: NDBCBuoyRow | null,
    beach: Beach,
    forecastTime: Date,
    ioosWaterTempC: number | null,
    coopsWaterTempC: number | null
  ): string | null {
    // Priority 1: IOOS observed water temperature (most geographically accurate)
    if (ioosWaterTempC != null && isFinite(ioosWaterTempC)) {
      const tempF = (ioosWaterTempC * 9) / 5 + 32;
      return formatWaterTemp(tempF);
    }

    // Priority 2: CO-OPS observed water temperature
    if (coopsWaterTempC != null && isFinite(coopsWaterTempC)) {
      const tempF = (coopsWaterTempC * 9) / 5 + 32;
      return formatWaterTemp(tempF);
    }

    // Priority 3: NDBC buoy water temperature (currently dead code — buoyData always null)
    if (buoyData?.water_temperature != null && isFinite(buoyData.water_temperature)) {
      return formatWaterTemp((buoyData.water_temperature * 9) / 5 + 32);
    }

    // Priority 4: Latitude-based estimation
    return this.estimateWaterTemperature(beach.lat, forecastTime);
  }
```

- [ ] **Step 4: Add `fetchCOOPSWaterTemp` to `EnhancedForecastService`**

Add this private method to `enhanced-forecast-service.ts` after `fetchIOOSWaterTemp` (after line 331):

```typescript
  /** Maximum age (in hours) for CO-OPS water temperature to be considered valid */
  private static readonly COOPS_STALENESS_HOURS = 48;

  /**
   * Fetch the latest CO-OPS water temperature for a beach.
   * Uses the CO-OPS station resolver to find the mapped station,
   * then fetches the latest water_temperature reading.
   */
  private async fetchCOOPSWaterTemp(beach: Beach): Promise<number | null> {
    return withRetry(async () => {
      const stationId = this.dataSourceManager
        .getCOOPSService()
        .getStationForLocation(beach.name, beach.lat, beach.lon);

      const result = await fetchWaterTemperature(stationId);

      if (!result) {
        return null;
      }

      // Staleness check
      const obsAge = Date.now() - new Date(result.observedAt).getTime();
      const stalenessMs =
        EnhancedForecastService.COOPS_STALENESS_HOURS * 60 * 60 * 1000;
      if (obsAge > stalenessMs) {
        log.debug(
          `CO-OPS water temp for ${beach.name} is stale (${Math.round(obsAge / 3600000)}h old), skipping`
        );
        return null;
      }

      return result.tempC;
    });
  }
```

Add the import at the top of `enhanced-forecast-service.ts`:

```typescript
import { fetchWaterTemperature } from "@/lib/services/noaa-coops/api-client";
```

- [ ] **Step 5: Add CO-OPS fetch to `Promise.allSettled` and thread results**

Update the `Promise.allSettled` block (lines 92-99):

```typescript
        const [waveData, tideData, weatherData, cdipData, ioosWaterTempResult, coopsWaterTempResult] =
          await Promise.allSettled([
            this.fetchWaveDataWithRetry(beach),
            this.fetchTidalDataWithRetry(beach),
            this.fetchWeatherDataWithRetry(beach),
            this.fetchCDIPDataWithRetry(beach),
            this.fetchIOOSWaterTemp(beach),
            this.fetchCOOPSWaterTemp(beach),
          ]);
```

Update the `processedData` object (lines 102-111) to include:

```typescript
          coopsWaterTempC: coopsWaterTempResult.status === "fulfilled" ? coopsWaterTempResult.value : null,
```

Add error logging after the IOOS log (after line 129):

```typescript
        if (coopsWaterTempResult.status === "rejected")
          logError(coopsWaterTempResult.reason, {
            beachId: beach.id,
            dataSource: "coops_water_temp",
          });
```

- [ ] **Step 6: Update `combineDataSources` to pass through `coopsWaterTempC`**

Update the `combineDataSources` parameter type (lines 336-352) and the `buildForecasts` call (lines 367-375) to include `coopsWaterTempC`:

In the destructured params, add:
```typescript
    coopsWaterTempC,
```

In the type annotation, add:
```typescript
    coopsWaterTempC: number | null;
```

In the `builder.buildForecasts` call, add:
```typescript
      coopsWaterTempC,
```

- [ ] **Step 7: Run existing tests to verify nothing is broken**

Run: `npx jest __tests__/lib/services/forecast/forecast-builder.test.ts --no-coverage`
Expected: Tests will FAIL because existing test calls to `buildForecasts` are missing the new `coopsWaterTempC` field.

- [ ] **Step 8: Fix existing tests — add `coopsWaterTempC: null` to all test inputs**

In `__tests__/lib/services/forecast/forecast-builder.test.ts`, add `coopsWaterTempC: null` to every `buildForecasts` call. There are approximately 4-5 test cases that call `buildForecasts` — each needs the new field. For example, the IOOS test (line 126):

```typescript
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: 26,
      coopsWaterTempC: null,
    });
```

- [ ] **Step 9: Add test for CO-OPS water temp priority**

Add to `__tests__/lib/services/forecast/forecast-builder.test.ts`:

```typescript
  it("uses CO-OPS water temperature when IOOS is unavailable", async () => {
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: 20, // 20°C = 68°F
    });

    expect(forecasts[0].water_temp).toBe("68°F");
  });

  it("prefers IOOS over CO-OPS water temperature", async () => {
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: 26, // 26°C = ~79°F
      coopsWaterTempC: 20, // 20°C = 68°F — should be ignored
    });

    expect(forecasts[0].water_temp).toBe("79°F");
  });

  it("falls back to latitude estimate when both IOOS and CO-OPS are null", async () => {
    const hawaiiBeach = { ...mockBeach, lat: 21.3, lon: -157.8 } as Beach;
    const forecasts = await builder.buildForecasts({
      beach: hawaiiBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    const tempF = parseInt(forecasts[0].water_temp || "0");
    expect(tempF).toBeGreaterThanOrEqual(69);
    expect(tempF).toBeLessThanOrEqual(81);
  });
```

- [ ] **Step 10: Run all tests**

Run: `npx jest __tests__/lib/services/forecast/forecast-builder.test.ts __tests__/lib/services/noaa-coops/api-client.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 11: Commit**

```bash
git add lib/services/enhanced-forecast-service.ts lib/services/forecast/forecast-builder.ts __tests__/lib/services/forecast/forecast-builder.test.ts
git commit -m "feat: add CO-OPS water temp as fallback in forecast pipeline

Beaches without IOOS buoy coverage (e.g., Jacksonville Beach) now get
real water temperature from their mapped CO-OPS tide station instead
of a flat-line latitude-based estimate.

Fallback chain: IOOS → CO-OPS → latitude estimation."
```

---

### Task 3: Verify integration end-to-end

**Files:** None — verification only

- [ ] **Step 1: Run the full forecast builder + API client test suites**

Run: `npx jest __tests__/lib/services/forecast/ __tests__/lib/services/noaa-coops/ --no-coverage`
Expected: All tests PASS

- [ ] **Step 2: Typecheck the project**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No type errors in modified files. Pre-existing errors in unrelated files are acceptable.

- [ ] **Step 3: Verify the CO-OPS API works for Jacksonville**

Run this quick verification (not committed — just for validation):

```bash
curl -s "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=8720218&product=water_temperature&range=24&units=metric&time_zone=gmt&format=json&application=quiver-surf-app" | python3 -m json.tool | head -20
```

Expected: JSON response with `data` array containing recent water temperature readings in Celsius from Mayport station.

- [ ] **Step 4: Update CHANGELOG.md**

Add under `[Unreleased]`:

```markdown
### Added
- CO-OPS water temperature fallback — beaches with mapped tide stations now get real observed water temperatures instead of flat-line latitude estimates
```
