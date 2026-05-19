/**
 * Tests for the v5 shadow calibration helpers.
 *
 * These exercise the deterministic math (bucketing, interpolation, guardrail)
 * with no Supabase dependency. The cached-loader path is covered separately
 * via integration tests once the migration lands.
 *
 * Cross-language parity is enforced at the bottom via
 * `seaside/tests/fixtures/v5_golden_vectors.json` — the SAME file is loaded
 * by `seaside/tests/test_calibration.py`. Any drift between this TS module
 * and the Python `score_v5` will fail one of those golden tests. v5.1 keeps
 * the existing W guardrail and passes raw OM through for NW >= 1.0m.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  bucketDirection,
  bucketOm,
  computeV5Shadow,
} from "../calibration-v5";

// Silence the logger so warn calls don't pollute output.
jest.mock("@/lib/logger", () => ({
  createContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Calibration fixture matching the seasonally-honest knots from
// seaside/reports/om_per_direction_calibration_2026-05-02.md
// and the W × 0.5–1.0m guardrail decided by the walk-forward audit.
const FIXTURE_CALIBRATION = {
  version: "v5_c.20260502_test",
  knots: {
    "<0.5m": { om_anchor: 0.40, obs: 0.806, n: 1092 },
    "0.5-1.0m": { om_anchor: 0.77, obs: 0.823, n: 15320 },
    "1.0-1.5m": { om_anchor: 1.19, obs: 1.120, n: 7318 },
    "1.5m+": { om_anchor: 1.79, obs: 1.669, n: 2391 },
  },
  g_dir: {
    "S/SW": { g: -0.095, n: 4100 },
    W: { g: -0.099, n: 3714 },
    NW: { g: 0.277, n: 307 },
    OTHER: { g: 0.014, n: 7199 },
  },
  guardrails: {
    passthrough_cells: [{ direction_bucket: "W" as const, om_bucket: "0.5-1.0m" as const }],
  },
};

describe("bucketOm", () => {
  it("buckets sub-0.5m as <0.5m", () => {
    expect(bucketOm(0.0)).toBe("<0.5m");
    expect(bucketOm(0.49)).toBe("<0.5m");
  });

  it("uses [0.5, 1.0) for 0.5–1.0m", () => {
    expect(bucketOm(0.5)).toBe("0.5-1.0m");
    expect(bucketOm(0.99)).toBe("0.5-1.0m");
  });

  it("uses [1.0, 1.5) for 1.0–1.5m", () => {
    expect(bucketOm(1.0)).toBe("1.0-1.5m");
    expect(bucketOm(1.49)).toBe("1.0-1.5m");
  });

  it("uses [1.5, ∞) for 1.5m+", () => {
    expect(bucketOm(1.5)).toBe("1.5m+");
    expect(bucketOm(5.0)).toBe("1.5m+");
  });

  it("returns null for null/NaN inputs", () => {
    expect(bucketOm(null)).toBeNull();
    expect(bucketOm(undefined)).toBeNull();
    expect(bucketOm(Number.NaN)).toBeNull();
  });
});

describe("bucketDirection", () => {
  it("S/SW covers 170–240 (240 exclusive)", () => {
    expect(bucketDirection(170)).toBe("S/SW");
    expect(bucketDirection(200)).toBe("S/SW");
    expect(bucketDirection(239)).toBe("S/SW");
    expect(bucketDirection(240)).toBe("OTHER");
  });

  it("W covers 250–280 (280 exclusive)", () => {
    expect(bucketDirection(250)).toBe("W");
    expect(bucketDirection(279)).toBe("W");
    expect(bucketDirection(280)).toBe("NW");
  });

  it("NW covers 280–340 (340 exclusive)", () => {
    expect(bucketDirection(280)).toBe("NW");
    expect(bucketDirection(339)).toBe("NW");
    expect(bucketDirection(340)).toBe("OTHER");
  });

  it("treats 240–250 gap and other ranges as OTHER", () => {
    expect(bucketDirection(0)).toBe("OTHER");
    expect(bucketDirection(245)).toBe("OTHER");
    expect(bucketDirection(355)).toBe("OTHER");
  });

  it("normalizes negative degrees and >360", () => {
    expect(bucketDirection(-160)).toBe("S/SW"); // ≡ 200
    expect(bucketDirection(560)).toBe("S/SW"); // ≡ 200
  });

  it("returns OTHER for null / NaN (matches calibration fallback)", () => {
    expect(bucketDirection(null)).toBe("OTHER");
    expect(bucketDirection(undefined)).toBe("OTHER");
    expect(bucketDirection(Number.NaN)).toBe("OTHER");
  });
});

describe("computeV5Shadow", () => {
  it("returns null when wave_height_om_m is missing", () => {
    expect(
      computeV5Shadow({
        wave_height_om_m: null,
        primary_swell_direction_deg: 200,
        calibration: FIXTURE_CALIBRATION,
      })
    ).toBeNull();
  });

  it("returns null when calibration is null", () => {
    expect(
      computeV5Shadow({
        wave_height_om_m: 1.0,
        primary_swell_direction_deg: 200,
        calibration: null,
      })
    ).toBeNull();
  });

  it("applies f(om) + g(dir) at OM 1.2m S/SW", () => {
    const result = computeV5Shadow({
      wave_height_om_m: 1.2,
      primary_swell_direction_deg: 200,
      calibration: FIXTURE_CALIBRATION,
    });
    expect(result).not.toBeNull();
    expect(result!.direction_bucket).toBe("S/SW");
    expect(result!.om_bucket).toBe("1.0-1.5m");
    expect(result!.v5_model_version).toBe("v5_1_nw_ge1_raw_om.20260502_test");
    // f(1.2) = interp between (1.19, 1.120) and (1.79, 1.669):
    //   t = (1.2 - 1.19) / (1.79 - 1.19) ≈ 0.01667
    //   f ≈ 1.120 + 0.01667 * (1.669 - 1.120) ≈ 1.1291
    // g(S/SW) = -0.095 → v5 ≈ 1.034
    expect(result!.v5_shadow_height_m).toBeCloseTo(1.034, 2);
  });

  it("applies the W × 0.5–1.0m guardrail (passes through raw OM)", () => {
    const result = computeV5Shadow({
      wave_height_om_m: 0.7,
      primary_swell_direction_deg: 265,
      calibration: FIXTURE_CALIBRATION,
    });
    expect(result).not.toBeNull();
    expect(result!.direction_bucket).toBe("W");
    expect(result!.om_bucket).toBe("0.5-1.0m");
    // Guardrail: identity, not f+g.
    expect(result!.v5_shadow_height_m).toBeCloseTo(0.7, 3);
  });

  it("does NOT apply guardrail at W × other OM buckets", () => {
    const result = computeV5Shadow({
      wave_height_om_m: 1.2,
      primary_swell_direction_deg: 265,
      calibration: FIXTURE_CALIBRATION,
    });
    // W at 1.0–1.5m: f(1.2)+g(W) = ~1.1291 - 0.099 ≈ 1.030 (not 1.2)
    expect(result!.v5_shadow_height_m).toBeCloseTo(1.030, 2);
  });

  it("saturates below the smallest knot (returns smallest obs)", () => {
    const result = computeV5Shadow({
      wave_height_om_m: 0.1,
      primary_swell_direction_deg: 200,
      calibration: FIXTURE_CALIBRATION,
    });
    // f(0.1) saturates at obs(<0.5m) = 0.806; g(S/SW)=-0.095 → 0.711
    expect(result!.v5_shadow_height_m).toBeCloseTo(0.711, 2);
  });

  it("passes raw OM through for NW 1.5m+ buckets", () => {
    const result = computeV5Shadow({
      wave_height_om_m: 3.0,
      primary_swell_direction_deg: 310,
      calibration: FIXTURE_CALIBRATION,
    });
    expect(result!.direction_bucket).toBe("NW");
    expect(result!.om_bucket).toBe("1.5m+");
    expect(result!.v5_shadow_height_m).toBeCloseTo(3.0, 3);
  });

  it("passes raw OM through for NW 1.0-1.5m buckets", () => {
    const result = computeV5Shadow({
      wave_height_om_m: 1.2,
      primary_swell_direction_deg: 310,
      calibration: FIXTURE_CALIBRATION,
    });
    expect(result).not.toBeNull();
    expect(result!.direction_bucket).toBe("NW");
    expect(result!.om_bucket).toBe("1.0-1.5m");
    expect(result!.v5_shadow_height_m).toBeCloseTo(1.2, 3);
  });

  it("keeps NW below 1.0m on f(om) without direction g", () => {
    const result = computeV5Shadow({
      wave_height_om_m: 0.8,
      primary_swell_direction_deg: 310,
      calibration: FIXTURE_CALIBRATION,
    });
    expect(result).not.toBeNull();
    expect(result!.direction_bucket).toBe("NW");
    expect(result!.om_bucket).toBe("0.5-1.0m");
    // f(0.8) ≈ 0.844; old v5 added +0.277, v5.1 intentionally does not.
    expect(result!.v5_shadow_height_m).toBeCloseTo(0.844, 2);
  });

  it("treats null direction as OTHER bucket", () => {
    const result = computeV5Shadow({
      wave_height_om_m: 1.2,
      primary_swell_direction_deg: null,
      calibration: FIXTURE_CALIBRATION,
    });
    expect(result!.direction_bucket).toBe("OTHER");
    // g(OTHER) = +0.014 → 1.129 + 0.014 ≈ 1.143
    expect(result!.v5_shadow_height_m).toBeCloseTo(1.143, 2);
  });

  it("rounds output to 3 decimals (NUMERIC(5,3) compatibility)", () => {
    const result = computeV5Shadow({
      wave_height_om_m: 1.234567,
      primary_swell_direction_deg: 200,
      calibration: FIXTURE_CALIBRATION,
    });
    const decimals = result!.v5_shadow_height_m.toString().split(".")[1] ?? "";
    expect(decimals.length).toBeLessThanOrEqual(3);
  });

  it("clamps negative v5 output to 0 (mirrors Python score_v5)", () => {
    // The standard April fixture can't reach this branch (smallest f anchor
    // 0.806, largest |g| 0.277 → never negative). Use a contrived calibration.
    const pathological = {
      version: "pathological",
      knots: {
        "<0.5m": { om_anchor: 0.40, obs: 0.10, n: 10 },
        "0.5-1.0m": { om_anchor: 0.77, obs: 0.20, n: 10 },
        "1.0-1.5m": { om_anchor: 1.19, obs: 0.30, n: 10 },
        "1.5m+": { om_anchor: 1.79, obs: 0.40, n: 10 },
      },
      g_dir: {
        "S/SW": { g: -1.0, n: 10 },
        W: { g: 0.0, n: 10 },
        NW: { g: 0.0, n: 10 },
        OTHER: { g: 0.0, n: 10 },
      },
      guardrails: {},
    };
    const result = computeV5Shadow({
      wave_height_om_m: 0.4,
      primary_swell_direction_deg: 200,
      calibration: pathological as never,
    });
    // f=0.10, g(SSW)=-1.0 → -0.9 → clamped to 0
    expect(result!.v5_shadow_height_m).toBe(0);
  });

  // Defensive shape-validation: a malformed calibration row (e.g. an empty
  // object from a mocked supabase fetch in tests, or a partial JSONB load)
  // must NOT throw — the v5 shadow path is invoked from the forecast hot
  // path and any throw would roll back the snapshot batch insert.
  it("returns null on calibration with no knots field", () => {
    const malformed = { version: "v5_c.bad", g_dir: {} } as unknown;
    const result = computeV5Shadow({
      wave_height_om_m: 1.2,
      primary_swell_direction_deg: 200,
      calibration: malformed as never,
    });
    expect(result).toBeNull();
  });

  it("returns null on calibration with empty knots object", () => {
    const malformed = {
      version: "v5_c.bad",
      knots: {},
      g_dir: {},
    } as unknown;
    const result = computeV5Shadow({
      wave_height_om_m: 1.2,
      primary_swell_direction_deg: 200,
      calibration: malformed as never,
    });
    expect(result).toBeNull();
  });

  it("returns null on calibration with no g_dir field", () => {
    const malformed = {
      version: "v5_c.bad",
      knots: { "<0.5m": { om_anchor: 0.4, obs: 0.8, n: 10 } },
    } as unknown;
    const result = computeV5Shadow({
      wave_height_om_m: 1.2,
      primary_swell_direction_deg: 200,
      calibration: malformed as never,
    });
    expect(result).toBeNull();
  });

  it("returns null on completely empty object (mocked-fetch case)", () => {
    // jest.setup.js mocks global.fetch to return {success: true, data: {}};
    // if that ever leaks into a calibration row we must NOT crash.
    const result = computeV5Shadow({
      wave_height_om_m: 1.2,
      primary_swell_direction_deg: 200,
      calibration: {} as never,
    });
    expect(result).toBeNull();
  });

  it("survives a calibration that throws on property access", () => {
    // Belt-and-suspenders: even if some upstream returns a Proxy that throws
    // on access, the outer try/catch in computeV5Shadow returns null cleanly.
    const exploding = new Proxy(
      {},
      {
        get() {
          throw new Error("synthetic property-access failure");
        },
      }
    );
    const result = computeV5Shadow({
      wave_height_om_m: 1.2,
      primary_swell_direction_deg: 200,
      calibration: exploding as never,
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cross-language parity: load the SAME JSON fixture the Python test uses, run
// every case through computeV5Shadow, and assert numeric agreement within
// 0.005m. If the seaside repo isn't checked out side-by-side (paths diverge
// outside the dev workspace), the suite skips with a console.warn rather than
// failing.
// ---------------------------------------------------------------------------

type GoldenCase = {
  name: string;
  om: number;
  dir_deg: number | null;
  v5: number;
  om_bucket: string;
  direction_bucket: string;
  passthrough: boolean;
};

type GoldenFixture = {
  calibration: {
    version: string;
    knots: Record<
      string,
      { om_anchor: number; obs: number; n: number }
    >;
    g_dir: Record<string, { g: number; n: number }>;
    guardrails: {
      passthrough_cells?: Array<{
        direction_bucket: string;
        om_bucket: string;
      }>;
    };
  };
  cases: GoldenCase[];
};

const GOLDEN_FIXTURE_PATH = path.resolve(
  __dirname,
  "../../../../../seaside/tests/fixtures/v5_golden_vectors.json"
);

function loadGoldenFixture(): GoldenFixture | null {
  try {
    const raw = fs.readFileSync(GOLDEN_FIXTURE_PATH, "utf-8");
    return JSON.parse(raw) as GoldenFixture;
  } catch {
    return null;
  }
}

const goldenFixture = loadGoldenFixture();

(goldenFixture ? describe : describe.skip)(
  "cross-language golden parity (seaside/tests/fixtures/v5_golden_vectors.json)",
  () => {
    if (!goldenFixture) {
      console.warn(
        `[calibration-v5.test] skipped: ${GOLDEN_FIXTURE_PATH} not found. ` +
          "If seaside repo is checked out, ensure it's at the expected sibling path."
      );
      return;
    }

    const cal = {
      version: goldenFixture.calibration.version,
      knots: goldenFixture.calibration.knots as never,
      g_dir: goldenFixture.calibration.g_dir as never,
      guardrails: goldenFixture.calibration.guardrails,
    };

    it.each(goldenFixture.cases.map((c) => [c.name, c]))(
      "%s",
      (_name, c) => {
        const tc = c as GoldenCase;
        const result = computeV5Shadow({
          wave_height_om_m: tc.om,
          primary_swell_direction_deg: tc.dir_deg,
          calibration: cal as never,
        });
        expect(result).not.toBeNull();
        expect(result!.om_bucket).toBe(tc.om_bucket);
        expect(result!.direction_bucket).toBe(tc.direction_bucket);
        expect(Math.abs(result!.v5_shadow_height_m - tc.v5)).toBeLessThanOrEqual(
          0.005
        );
      }
    );
  }
);
