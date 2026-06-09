/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SevenDayTideTable } from "@/components/intent/seven-day-tide-table";
import type { TideDayExtrema } from "@/actions/forecast/intent-forecast-actions";

describe("SevenDayTideTable", () => {
  it("uses compact brand empty-state copy for a day with no tide extrema", () => {
    const days: TideDayExtrema[] = [
      {
        date: "2026-06-09",
        label: "Today",
        isToday: true,
        events: [],
      },
    ];

    render(<SevenDayTideTable days={days} />);

    expect(screen.getByText("no data")).toBeInTheDocument();
    expect(screen.queryByText("No data available")).not.toBeInTheDocument();
  });
});
