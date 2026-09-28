import { render, screen } from "@testing-library/react";
import { BeachTabs } from "@/components/beach-detail/beach-tabs";

jest.mock("@/hooks/use-track-event", () => ({ useTrackEvent: () => ({ track: jest.fn() }) }));

describe("BeachTabs visibleTabs", () => {
  it("shows only the tabs it's given", () => {
    render(
      <BeachTabs activeTab="reviews" onTabChange={jest.fn()} visibleTabs={["reviews", "intel", "sessions"]}>
        <div />
      </BeachTabs>,
    );
    expect(screen.getAllByRole("tab").map((t) => t.textContent?.trim().toLowerCase())).toEqual(
      expect.arrayContaining([expect.stringContaining("review"), expect.stringContaining("intel"), expect.stringContaining("session")]),
    );
    expect(screen.queryByRole("tab", { name: /forecast/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /overview/i })).toBeNull();
  });

  it("keeps all five by default", () => {
    render(<BeachTabs activeTab="forecast" onTabChange={jest.fn()}><div /></BeachTabs>);
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });
});
