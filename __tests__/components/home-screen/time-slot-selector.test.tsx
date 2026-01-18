import { render, screen } from "@testing-library/react";
import { TimeSlotSelector } from "@/components/home-screen/time-slot-selector";

describe("TimeSlotSelector", () => {
  const defaultProps = {
    value: "any" as const,
    onChange: jest.fn(),
  };

  it("renders all time slot options", () => {
    render(<TimeSlotSelector {...defaultProps} />);

    expect(screen.getByText("Any time")).toBeInTheDocument();
    expect(screen.getByText("Dawn patrol")).toBeInTheDocument();
    expect(screen.getByText("Morning")).toBeInTheDocument();
    expect(screen.getByText("Afternoon")).toBeInTheDocument();
  });

  it("displays icons for each time slot", () => {
    render(<TimeSlotSelector {...defaultProps} />);

    // Icons should be present (as SVG elements within buttons)
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button.querySelector("svg")).toBeInTheDocument();
    });
  });

  it("marks selected slot with aria-pressed", () => {
    render(<TimeSlotSelector {...defaultProps} value="morning" />);

    const morningButton = screen.getByText("Morning").closest("button");
    expect(morningButton).toHaveAttribute("aria-pressed", "true");
  });
});
