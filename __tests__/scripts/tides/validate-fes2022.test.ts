import { matchTurns, metrics } from "../../../scripts/tides/validate-fes2022";

it("matches same-type turns within three hours and keeps model-minus-reference timing", () => {
  const reference = [
    { ts: "2026-09-29T10:00:00Z", type: "high" as const, tide_height_m: 2 },
    { ts: "2026-09-29T16:00:00Z", type: "low" as const, tide_height_m: 0 },
  ];
  const model = [
    { ts: "2026-09-29T10:10:00Z", type: "high" as const, tide_height_m: 2.1 },
    { ts: "2026-09-29T16:10:00Z", type: "low" as const, tide_height_m: 0.1 },
    { ts: "2026-09-30T01:00:00Z", type: "high" as const, tide_height_m: 3 },
  ];
  const matches = matchTurns(model, reference);
  expect(matches.map(({ dtMinutes }) => dtMinutes)).toEqual([10, 10]);
  expect(metrics(matches, 2)).toMatchObject({ matched: "2/2", medianAbsDt: 10, meanDt: 10, rangeRatio: 1, pass: true });
  expect(matchTurns(model.slice(2), reference)).toEqual([]);
});
