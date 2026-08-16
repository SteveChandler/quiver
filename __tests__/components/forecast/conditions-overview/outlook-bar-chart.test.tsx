import React from "react";
import { render, screen } from "@testing-library/react";
import { OutlookBarChart } from "@/components/forecast/conditions-overview/outlook-bar-chart";
import type { EnrichedDaySummary } from "@/lib/utils/enriched-day-summary";

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: ({
    children,
    minPointSize,
  }: {
    children: React.ReactNode;
    minPointSize?: number;
  }) => (
    <div data-testid="score-bars" data-min-point-size={minPointSize}>
      {children}
    </div>
  ),
  Cell: ({ fill }: { fill?: string }) => (
    <span data-testid="score-bar" data-fill={fill} />
  ),
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

function createDay(overrides: Partial<EnrichedDaySummary>): EnrichedDaySummary {
  return {
    date: "Aug 4",
    dayName: "Today",
    minHeight: 1,
    maxHeight: 2,
    tier: "meh",
    score: 0,
    fullDate: "2026-08-04",
    isToday: false,
    bestTime: "06:00",
    period: 10,
    windConditions: "light",
    bestTimeSlot: "morning",
    windSpeed: "3 mph",
    ...overrides,
  };
}

describe("OutlookBarChart", () => {
  it("keeps zero-score days visible as minimum-height bars", () => {
    const days = [
      createDay({ score: 65, tier: "good", isToday: true }),
      createDay({
        date: "Aug 5",
        dayName: "Wed",
        fullDate: "2026-08-05",
        score: 0,
      }),
    ];

    render(<OutlookBarChart days={days} />);

    expect(screen.getByTestId("score-bars")).toHaveAttribute(
      "data-min-point-size",
      "4",
    );
    const bars = screen.getAllByTestId("score-bar");
    expect(bars).toHaveLength(2);
    expect(bars[1]).toHaveAttribute("data-fill", "#64748B");
  });
});
