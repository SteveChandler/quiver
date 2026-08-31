import {
  loadIntegrityReportEnv,
  runCanaryReport,
  type CanaryReportReader,
} from "../trusted-forecast-canary-report";
import { TRUSTED_FORECAST_POLICY_VERSION } from "../../lib/services/forecast/trusted-forecast-policy";

const CANARY_A = "11111111-1111-4111-8111-111111111111";
const CANARY_B = "22222222-2222-4222-8222-222222222222";
const BEACH_ID = "33333333-3333-4333-8333-333333333333";
const FORECAST_AT = "2026-08-30T12:00:00.000Z";

function reader(): CanaryReportReader & Record<string, jest.Mock> {
  return {
    selectApplications: jest.fn(async () => [
      {
        beachId: BEACH_ID,
        beach: "synthetic-beach",
        forecastAt: FORECAST_AT,
        baselineMaxFaceFt: 4,
        adjustedMaxFaceFt: 4.5,
        deltaFt: 0.5,
        policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
      },
    ]),
    selectBaselines: jest.fn(async () => [
      {
        beachId: BEACH_ID,
        forecastAt: FORECAST_AT,
        waveHeight: "4 ft",
      },
    ]),
    insert: jest.fn(() => {
      throw new Error("write attempted");
    }),
    update: jest.fn(() => {
      throw new Error("write attempted");
    }),
    upsert: jest.fn(() => {
      throw new Error("write attempted");
    }),
    delete: jest.fn(() => {
      throw new Error("write attempted");
    }),
    rpc: jest.fn(() => {
      throw new Error("write attempted");
    }),
  };
}

describe("trusted forecast canary report", () => {
  it("compares baseline to adjusted slots without writes or configured UUID output", async () => {
    const reportReader = reader();
    const lines: string[] = [];
    const code = await runCanaryReport({
      reader: reportReader,
      env: { canaryUserIds: `${CANARY_A},${CANARY_B}` },
      now: new Date("2026-08-29T00:00:00.000Z"),
      log: (line) => lines.push(line),
    });

    expect(code).toBe(0);
    expect(reportReader.selectApplications).toHaveBeenCalledTimes(1);
    expect(reportReader.selectBaselines).toHaveBeenCalledTimes(1);
    for (const method of ["insert", "update", "upsert", "delete", "rpc"]) {
      expect(reportReader[method]).not.toHaveBeenCalled();
    }
    const output = lines.join("\n");
    expect(output).not.toContain(CANARY_A);
    expect(output).not.toContain(CANARY_B);
    expect(output).not.toContain(BEACH_ID);
    expect(output).toContain("synthetic-beach");
    expect(output).toContain(TRUSTED_FORECAST_POLICY_VERSION);
    expect(output).toContain('"deltaFt": 0.5');
    expect(output).toContain('"integrityMismatchCount": 0');
    expect(output).toContain('"reportType": "TRUSTED_FORECAST_INTEGRITY"');
    expect(output).toContain('"storedBaselineDeviationCount": 0');
  });

  it.each([undefined, "", CANARY_A, `${CANARY_A},${CANARY_A}`])(
    "denies invalid account configuration without reading: %p",
    async (canaryUserIds) => {
      const reportReader = reader();
      const lines: string[] = [];
      const code = await runCanaryReport({
        reader: reportReader,
        env: { canaryUserIds },
        log: (line) => lines.push(line),
      });

      expect(code).toBe(1);
      expect(reportReader.selectApplications).not.toHaveBeenCalled();
      expect(lines.join("\n")).not.toContain(CANARY_A);
    },
  );

  it("fails integrity when policy or baseline does not match", async () => {
    const reportReader = reader();
    reportReader.selectApplications.mockResolvedValueOnce([
      {
        beachId: BEACH_ID,
        beach: "synthetic-beach",
        forecastAt: FORECAST_AT,
        baselineMaxFaceFt: 4,
        adjustedMaxFaceFt: 4.5,
        deltaFt: 0.5,
        policyVersion: "stale-policy",
      },
    ]);
    reportReader.selectBaselines.mockResolvedValueOnce([
      { beachId: BEACH_ID, forecastAt: FORECAST_AT, waveHeight: "3 ft" },
    ]);

    expect(
      await runCanaryReport({
        reader: reportReader,
        env: { canaryUserIds: `${CANARY_A},${CANARY_B}` },
        log: () => undefined,
      }),
    ).toBe(1);
  });

  it("flags detectable stored rows that differ from the recomputed baseline", async () => {
    const reportReader = reader();
    reportReader.selectBaselines.mockResolvedValueOnce([
      { beachId: BEACH_ID, forecastAt: FORECAST_AT, waveHeight: "8 ft" },
    ]);
    const lines: string[] = [];

    expect(
      await runCanaryReport({
        reader: reportReader,
        env: { canaryUserIds: `${CANARY_A},${CANARY_B}` },
        log: (line) => lines.push(line),
      }),
    ).toBe(1);
    expect(lines.join("\n")).toContain('"storedBaselineDeviationCount": 1');
  });

  it("loads production-local env before local env", () => {
    const load = jest.fn();

    loadIntegrityReportEnv(load);

    expect(load.mock.calls).toEqual([
      [{ path: ".env.production.local" }],
      [{ path: ".env.local" }],
    ]);
  });
});
