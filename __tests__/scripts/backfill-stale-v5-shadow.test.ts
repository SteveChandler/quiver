import {
  BACKFILL_CONFIRMATION,
  buildV5Patch,
  parseCliArgs,
} from "../../scripts/backfill-stale-v5-shadow";
import type { CalibrationVersion } from "../../lib/services/forecast/calibration-v5";
import fs from "node:fs";

const calibration: CalibrationVersion = {
  version: "v5_c.20260525_0630",
  knots: {
    "<0.5m": { om_anchor: 0.25, obs: 0.25, n: 50 },
    "0.5-1.0m": { om_anchor: 0.75, obs: 0.75, n: 50 },
    "1.0-1.5m": { om_anchor: 1.25, obs: 1.0, n: 50 },
    "1.5m+": { om_anchor: 1.75, obs: 1.5, n: 50 },
  },
  g_dir: {
    "S/SW": { g: 0, n: 50 },
    W: { g: 0, n: 50 },
    NW: { g: 0, n: 50 },
    OTHER: { g: 0, n: 50 },
  },
  guardrails: null,
};

describe("backfill-stale-v5-shadow safety helpers", () => {
  it("does not load dotenv files when imported for helper tests", () => {
    jest.resetModules();
    const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);
    const config = jest.fn();
    jest.doMock("dotenv", () => ({ config }));

    jest.isolateModules(() => {
      require("../../scripts/backfill-stale-v5-shadow");
    });

    expect(config).not.toHaveBeenCalled();
    existsSpy.mockRestore();
    jest.dontMock("dotenv");
  });

  it("defaults to dry-run for the OM-present null-v5 target", () => {
    const args = parseCliArgs([
      "--target",
      "om-present-null-v5",
      "--since",
      "2026-05-10",
      "--until",
      "2026-05-22",
    ]);

    expect(args.target).toBe("om-present-null-v5");
    expect(args.dryRun).toBe(true);
    expect(args.write).toBe(false);
  });

  it("rejects write mode without the explicit hindcast confirmation", () => {
    expect(() => parseCliArgs(["--write"])).toThrow(
      `--write requires --confirm=${BACKFILL_CONFIRMATION}`
    );
  });

  it("accepts write mode only with the explicit hindcast confirmation", () => {
    const args = parseCliArgs([
      "--write",
      `--confirm=${BACKFILL_CONFIRMATION}`,
    ]);

    expect(args.write).toBe(true);
    expect(args.dryRun).toBe(false);
  });

  it("builds a v5-only update patch tagged as backfill_hindcast", () => {
    const patch = buildV5Patch(
      {
        id: "row-1",
        beach_id: "beach-1",
        predicted_at: "2026-05-28T21:00:00+00:00",
        wave_height_om: 1.2,
        wave_direction_deg: 270,
      },
      calibration
    );

    expect(patch).toEqual({
      id: "row-1",
      patch: {
        v5_shadow_height_m: 0.975,
        v5_model_version:
          "v5_1_nw_ge1_raw_om.20260525_0630.backfill_hindcast",
        direction_bucket: "W",
        om_bucket: "1.0-1.5m",
      },
    });
    expect(Object.keys(patch!.patch).sort()).toEqual([
      "direction_bucket",
      "om_bucket",
      "v5_model_version",
      "v5_shadow_height_m",
    ]);
  });
});
