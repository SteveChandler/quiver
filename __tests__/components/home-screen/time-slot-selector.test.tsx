import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(screen.getByText("Lunch session")).toBeInTheDocument();
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
    render(<TimeSlotSelector {...defaultProps} value="lunch-session" />);

    const lunchSessionButton = screen.getByText("Lunch session").closest("button");
    expect(lunchSessionButton).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onChange when a time slot is clicked", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<TimeSlotSelector value="any" onChange={onChange} />);

    await user.click(screen.getByText("Lunch session"));

    expect(onChange).toHaveBeenCalledWith("lunch-session");
  });

  it("applies motion wrapper for animations", () => {
    render(<TimeSlotSelector {...defaultProps} />);

    // The component should have data-testid for the animated container
    expect(screen.getByTestId("time-slot-selector")).toBeInTheDocument();
  });
});
