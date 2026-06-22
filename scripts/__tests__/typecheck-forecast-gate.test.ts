import {
  FORECAST_GATE_TYPECHECK_TARGETS,
  getMissingForecastGateTypecheckTargets,
} from "../typecheck-forecast-gate";

describe("typecheck-forecast-gate", () => {
  it("has no missing configured forecast gate targets", () => {
    expect(getMissingForecastGateTypecheckTargets()).toEqual([]);
  });

  it("reports missing configured targets", () => {
    expect(
      getMissingForecastGateTypecheckTargets([
        ...FORECAST_GATE_TYPECHECK_TARGETS,
        "scripts/does-not-exist.ts",
      ])
    ).toEqual(["scripts/does-not-exist.ts"]);
  });
});
