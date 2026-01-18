import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrimaryActions } from "@/components/home-screen/primary-actions";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe("PrimaryActions", () => {
  const mockRecommendation = {
    beach: { id: "test-beach", name: "Test Beach" },
    score: 85,
    window: { start: new Date(), end: new Date(), timezone: "America/Los_Angeles" },
  } as any;

  const defaultProps = {
    topRecommendation: mockRecommendation,
    onAtBeach: jest.fn(),
    onPlanWeekend: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders both action buttons", () => {
    render(<PrimaryActions {...defaultProps} />);

    expect(screen.getByTestId("at-beach-button")).toBeInTheDocument();
    expect(screen.getByTestId("plan-weekend-button")).toBeInTheDocument();
  });

  it("calls onAtBeach when primary button clicked", async () => {
    const user = userEvent.setup();
    render(<PrimaryActions {...defaultProps} />);

    await user.click(screen.getByTestId("at-beach-button"));

    expect(defaultProps.onAtBeach).toHaveBeenCalled();
  });

  it("calls onPlanWeekend when secondary button clicked", async () => {
    const user = userEvent.setup();
    render(<PrimaryActions {...defaultProps} />);

    await user.click(screen.getByTestId("plan-weekend-button"));

    expect(defaultProps.onPlanWeekend).toHaveBeenCalled();
  });

  it("disables buttons when disabled prop is true", () => {
    render(<PrimaryActions {...defaultProps} disabled />);

    expect(screen.getByTestId("at-beach-button")).toBeDisabled();
    expect(screen.getByTestId("plan-weekend-button")).toBeDisabled();
  });

  it("has gradient background on primary button", () => {
    render(<PrimaryActions {...defaultProps} />);

    const primaryButton = screen.getByTestId("at-beach-button");
    expect(primaryButton.className).toMatch(/bg-gradient/);
  });
});
