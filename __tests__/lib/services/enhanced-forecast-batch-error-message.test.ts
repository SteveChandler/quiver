/**
 * Supabase returns `{ error }` as a plain object, not an Error. The batch
 * updaters throw it from beach selection, so a statement timeout (SQLSTATE
 * 57014) used to surface as "Unknown error" in cron_runs and Sentry.
 */

// Marks this file as a module so its helpers do not merge into the global scope
// shared with other test scripts under tsc.
export {};

const STATEMENT_TIMEOUT = {
  message: "canceling statement due to statement timeout",
  code: "57014",
  details: null,
  hint: null,
};

function makeSupabaseWhoseLatestViewTimesOut() {
  const beaches = [{ id: "b1", name: "b1", lat: 1, lon: 1, cdip_eligible: true }];
  return {
    from: (table: string) => {
      if (table === "beaches") {
        return {
          select: () => {
            const result = Promise.resolve({ data: beaches, error: null });
            return Object.assign(result, {
              eq: () => Promise.resolve({ data: beaches, error: null }),
            });
          },
        };
      }
      if (table === "v_enhanced_forecast_latest") {
        return {
          select: () => Promise.resolve({ data: null, error: STATEMENT_TIMEOUT }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
  };
}

async function loadServiceWithTimedOutLatestView() {
  jest.resetModules();
  jest.doMock("@/lib/supabase/server", () => ({
    createSupabaseServiceRoleClient: async () => makeSupabaseWhoseLatestViewTimesOut(),
  }));
  const { EnhancedForecastService } = await import(
    "@/lib/services/enhanced-forecast-service"
  );
  return new EnhancedForecastService();
}

describe("EnhancedForecastService batch updaters surface the real database error", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("updateAllEnhancedForecasts reports the statement timeout, not 'Unknown error'", async () => {
    const service = await loadServiceWithTimedOutLatestView();

    const result = await service.updateAllEnhancedForecasts();

    expect(result.success).toBe(false);
    expect(result.error).toBe("canceling statement due to statement timeout (57014)");
  });

  it("updateCdipEnhancedForecasts reports the statement timeout, not 'Unknown error'", async () => {
    const service = await loadServiceWithTimedOutLatestView();

    const result = await service.updateCdipEnhancedForecasts();

    expect(result.success).toBe(false);
    expect(result.error).toBe("canceling statement due to statement timeout (57014)");
  });
});
