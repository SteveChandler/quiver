import { render, screen } from "@testing-library/react";
import { SonarPing } from "@/components/surf-drops/sonar-ping";

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: jest.fn(),
}));

import * as ReducedMotionModule from "@/hooks/use-reduced-motion";
const useReducedMotion = ReducedMotionModule.useReducedMotion as jest.Mock;

describe("SonarPing", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("renders three animated rings when motion is allowed", () => {
    useReducedMotion.mockReturnValue(false);
    render(<SonarPing />);

    const ping = screen.getByTestId("sonar-ping");
    expect(ping.dataset.reducedMotion).toBe("false");
    expect(ping.className).toContain("sonar-ping");
    expect(ping.className).not.toContain("sonar-ping--reduced");
    expect(ping.querySelectorAll(".sonar-ping__ring")).toHaveLength(3);
  });

  it("adds the reduced-motion class when the user prefers reduced motion", () => {
    useReducedMotion.mockReturnValue(true);
    render(<SonarPing />);

    const ping = screen.getByTestId("sonar-ping");
    expect(ping.dataset.reducedMotion).toBe("true");
    expect(ping.className).toContain("sonar-ping--reduced");
  });

  it("respects a custom color prop via CSS variable", () => {
    useReducedMotion.mockReturnValue(false);
    render(<SonarPing color="#123456" size={48} />);

    const ping = screen.getByTestId("sonar-ping");
    expect(ping.style.width).toBe("48px");
    expect(ping.style.getPropertyValue("--sonar-color")).toBe("#123456");
  });
});
