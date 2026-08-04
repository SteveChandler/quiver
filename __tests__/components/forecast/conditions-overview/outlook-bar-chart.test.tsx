import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { OutlookBarChart } from "@/components/forecast/conditions-overview/outlook-bar-chart";
import type { EnrichedDaySummary } from "@/lib/utils/enriched-day-summary";

jest.mock("recharts", () => ({
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: (props: { minPointSize?: number; children: ReactNode }) => (
    <div data-testid="forecast-bar" data-min-point-size={props.minPointSize}>
      {props.children}
    </div>
  ),
  Cell: () => <div data-testid="forecast-bar-cell" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ReferenceLine: () => <div />,
}));

function makeDay(score: number): EnrichedDaySummary {
  return {
    date: "Jul 31",
    dayName: "Fri",
    minHeight: 0,
    maxHeight: 1,
    tier: "marginal",
    score,
    fullDate: "2026-07-31",
    isToday: false,
    bestTime: "08:00",
    period: 12,
    windConditions: "light",
    bestTimeSlot: "morning",
    windSpeed: "1 mph",
  };
}

describe("OutlookBarChart", () => {
  it("keeps zero-score forecast days visible", () => {
    render(<OutlookBarChart days={[makeDay(62), makeDay(0)]} />);

    expect(screen.getByTestId("forecast-bar")).toHaveAttribute(
      "data-min-point-size",
      "3",
    );
    expect(screen.getByRole("img", { name: /daily surf condition scores/i })).toBeInTheDocument();
  });
});
