import { render, screen } from "@testing-library/react";
import { ReadingAge, StatusChip } from "@/components/buoys/live-status";
import { liveLimitMs } from "@/lib/buoy-pages/status";

const NOW = Date.parse("2026-11-11T06:00:00Z");
const lastWaveAt = new Date(NOW - 3.2 * 60 * 60 * 1000).toISOString();

describe("<StatusChip/> per-source Live limit", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("applies the same Live limit as the server for a late source", () => {
    const qld = { source: "aodn" as const, owner: "Queensland Department of Environment and Science" };
    render(
      <StatusChip lastWaveAt={lastWaveAt} serverStatus="fresh" absolute="Nov 11, 12:48 PM AEST" freshForMs={liveLimitMs(qld)} />,
    );
    expect(screen.getByTestId("buoy-status-chip")).toHaveAttribute("data-status", "fresh");
  });

  it("marks the same 3.2 h old reading Stale for a 3 h source", () => {
    render(
      <StatusChip lastWaveAt={lastWaveAt} serverStatus="fresh" absolute="Nov 10, 6:48 PM PST" freshForMs={liveLimitMs({ source: "ndbc", owner: null })} />,
    );
    expect(screen.getByTestId("buoy-status-chip")).toHaveAttribute("data-status", "stale");
  });

  it("still shows the true reading time", () => {
    render(<ReadingAge lastWaveAt={lastWaveAt} serverStatus="fresh" absolute="Nov 11, 12:48 PM AEST" />);
    expect(screen.getByText("Nov 11, 12:48 PM AEST").closest("time")).toHaveAttribute("dateTime", lastWaveAt);
  });
});
