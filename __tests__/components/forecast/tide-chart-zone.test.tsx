/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";

import { zoneMidnights } from "@/components/forecast/tide-chart-recharts";
import { TideTooltip } from "@/components/forecast/tide-chart/TideTooltip";

describe("zoneMidnights", () => {
  it("puts day marks at midnight in the beach's zone, not the viewer's", () => {
    const days = zoneMidnights(
      Date.parse("2026-11-14T19:00:00Z"),
      Date.parse("2026-11-16T19:00:00Z"),
      "Pacific/Honolulu"
    ).map((d) => d.toISOString());
    expect(days).toEqual([
      "2026-11-14T10:00:00.000Z",
      "2026-11-15T10:00:00.000Z",
      "2026-11-16T10:00:00.000Z",
    ]);
  });

  it("stays on midnight across a DST change", () => {
    const days = zoneMidnights(
      Date.parse("2026-10-31T12:00:00Z"),
      Date.parse("2026-11-02T12:00:00Z"),
      "America/Los_Angeles"
    ).map((d) => d.toISOString());
    expect(days).toEqual([
      "2026-10-31T07:00:00.000Z",
      "2026-11-01T07:00:00.000Z",
      "2026-11-02T08:00:00.000Z",
    ]);
  });
});

describe("TideTooltip", () => {
  it("prints the point's time in the given zone", () => {
    render(
      <TideTooltip
        active
        unit="ft"
        timeZone="Pacific/Honolulu"
        payload={[{ payload: { t: Date.parse("2026-11-14T23:27:00Z"), h: 0.3, isLow: true } }]}
      />
    );
    expect(screen.getByText(/Sat, Nov 14 • 1:27\sPM/)).toBeInTheDocument();
  });
});
