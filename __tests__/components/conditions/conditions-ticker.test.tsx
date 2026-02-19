import { render, screen, within } from "@testing-library/react";
import { ConditionsTicker } from "@/components/conditions/conditions-ticker";
import type { ConditionsData } from "@/types/conditions";

jest.mock("@/components/ui/animated-wave-icon", () => ({
  AnimatedWaveIcon: () => <span data-testid="wave-icon" />,
}));

const fullData: ConditionsData = {
  waveHeight: "3-5ft",
  wavePeriod: "12s",
  waveDirection: "SW",
  windSpeed: "8mph",
  windDirection: "NW",
  waterTemp: "62°F",
  tideStatus: "Rising",
  tideHeight: "3.2ft",
};

describe("ConditionsTicker", () => {
  it("renders all cards with correct values when full data provided", () => {
    render(<ConditionsTicker data={fullData} />);

    const track = within(screen.getByTestId("ticker-content"));
    expect(track.getByText("Waves")).toBeInTheDocument();
    expect(track.getByText("3-5ft")).toBeInTheDocument();
    expect(track.getByText("Swell")).toBeInTheDocument();
    expect(track.getByText("12s SW")).toBeInTheDocument();
    expect(track.getByText("Wind")).toBeInTheDocument();
    expect(track.getByText("8mph NW")).toBeInTheDocument();
    expect(track.getByText("Water")).toBeInTheDocument();
    expect(track.getByText("62°F")).toBeInTheDocument();
    expect(track.getByText("Tide")).toBeInTheDocument();
    expect(track.getByText("Rising 3.2ft")).toBeInTheDocument();
  });

  it("renders fewer cards with partial data", () => {
    render(<ConditionsTicker data={{ waveHeight: "2ft", waterTemp: "60°F" }} />);

    const track = within(screen.getByTestId("ticker-content"));
    expect(track.getByText("Waves")).toBeInTheDocument();
    expect(track.getByText("Water")).toBeInTheDocument();
    expect(track.queryByText("Swell")).not.toBeInTheDocument();
    expect(track.queryByText("Wind")).not.toBeInTheDocument();
    expect(track.queryByText("Tide")).not.toBeInTheDocument();
  });

  it("returns null when data is empty", () => {
    const { container } = render(<ConditionsTicker data={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies dark theme classes", () => {
    render(<ConditionsTicker data={fullData} theme="dark" />);

    const region = screen.getByRole("region");
    expect(region.className).toContain("bg-[#2a2a2a]");
    expect(region.className).toContain("text-gray-300");
  });

  it("applies light theme classes by default", () => {
    render(<ConditionsTicker data={fullData} />);

    const region = screen.getByRole("region");
    expect(region.className).toContain("bg-white");
    expect(region.className).toContain("border-gray-100");
    expect(region.className).toContain("text-gray-700");
  });

  it("shows skeleton when loading", () => {
    render(<ConditionsTicker data={fullData} loading />);

    expect(screen.getByTestId("conditions-ticker-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Waves")).not.toBeInTheDocument();
  });

  it("includes beachName in aria-label when provided", () => {
    render(<ConditionsTicker data={fullData} beachName="Ocean Beach" />);

    const region = screen.getByRole("region");
    expect(region).toHaveAttribute(
      "aria-label",
      "Ocean Beach current conditions"
    );
  });

  it("uses default aria-label when no beachName", () => {
    render(<ConditionsTicker data={fullData} />);

    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Current surf conditions");
  });

  it("renders wave icon with aria-hidden via AnimatedWaveIcon", () => {
    render(<ConditionsTicker data={{ waveHeight: "3ft" }} />);

    const track = within(screen.getByTestId("ticker-content"));
    const waveIcon = track.getByTestId("wave-icon");
    expect(waveIcon).toBeInTheDocument();
  });

  it("renders dividers between cards", () => {
    render(<ConditionsTicker data={fullData} />);

    const track = screen.getByTestId("ticker-content");
    // Dividers are aria-hidden spans with w-px class
    const dividers = track.querySelectorAll("[aria-hidden='true'].w-px");
    // 5 cards = 4 dividers between them
    expect(dividers).toHaveLength(4);
  });

  it("applies custom className", () => {
    render(<ConditionsTicker data={fullData} className="mt-4" />);

    const region = screen.getByRole("region");
    expect(region.className).toContain("mt-4");
  });
});
