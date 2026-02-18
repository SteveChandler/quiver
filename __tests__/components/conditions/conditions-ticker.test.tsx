import { render, screen } from "@testing-library/react";
import { ConditionsTicker } from "@/components/conditions/conditions-ticker";
import type { ConditionsData } from "@/types/conditions";

jest.mock("@/components/ui/animated-wave-icon", () => ({
  AnimatedWaveIcon: () => <span data-testid="wave-icon" />,
}));

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
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

    expect(screen.getByText("Waves")).toBeInTheDocument();
    expect(screen.getByText("3-5ft")).toBeInTheDocument();
    expect(screen.getByText("Swell")).toBeInTheDocument();
    expect(screen.getByText("12s SW")).toBeInTheDocument();
    expect(screen.getByText("Wind")).toBeInTheDocument();
    expect(screen.getByText("8mph NW")).toBeInTheDocument();
    expect(screen.getByText("Water")).toBeInTheDocument();
    expect(screen.getByText("62°F")).toBeInTheDocument();
    expect(screen.getByText("Tide")).toBeInTheDocument();
    expect(screen.getByText("Rising 3.2ft")).toBeInTheDocument();
  });

  it("renders fewer cards with partial data", () => {
    render(<ConditionsTicker data={{ waveHeight: "2ft", waterTemp: "60°F" }} />);

    expect(screen.getByText("Waves")).toBeInTheDocument();
    expect(screen.getByText("Water")).toBeInTheDocument();
    expect(screen.queryByText("Swell")).not.toBeInTheDocument();
    expect(screen.queryByText("Wind")).not.toBeInTheDocument();
    expect(screen.queryByText("Tide")).not.toBeInTheDocument();
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

    const waveIcon = screen.getByTestId("wave-icon");
    expect(waveIcon).toBeInTheDocument();
  });

  it("renders dividers between cards", () => {
    const { container } = render(<ConditionsTicker data={fullData} />);

    // Dividers are aria-hidden spans with w-px class
    const dividers = container.querySelectorAll("[aria-hidden='true'].w-px");
    // 5 cards = 4 dividers between them
    expect(dividers).toHaveLength(4);
  });

  it("applies custom className", () => {
    render(<ConditionsTicker data={fullData} className="mt-4" />);

    const region = screen.getByRole("region");
    expect(region.className).toContain("mt-4");
  });
});
