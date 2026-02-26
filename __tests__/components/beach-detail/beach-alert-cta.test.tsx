import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BeachAlertCta } from "@/components/beach-detail/beach-alert-cta";
import { useAuth } from "@/context/auth-context";

jest.mock("@/context/auth-context");
jest.mock("next/navigation", () => ({ usePathname: () => "/ca/san-diego/blacks" }));
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: (props: any) =>
    props.isOpen ? (
      <div data-testid="auth-modal" data-source={props.source} />
    ) : null,
}));

const mockSetPendingAction = jest.fn();
const mockClearPendingAction = jest.fn();

jest.mock("@/hooks/use-pending-action", () => ({
  usePendingAction: () => ({
    pendingAction: null,
    setPendingAction: mockSetPendingAction,
    clearPendingAction: mockClearPendingAction,
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const defaultProps = {
  beachId: "beach-123",
  beachName: "Blacks Beach",
};

describe("BeachAlertCta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("renders Bell icon and Get Alerts text", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null as any,
        isLoading: false,
        isAuthenticated: false,
        signUp: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);
    });

    it("renders a button with Get Alerts text", () => {
      render(<BeachAlertCta {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /get alerts/i })
      ).toBeInTheDocument();
    });

    it("renders a Bell icon inside the button", () => {
      const { container } = render(<BeachAlertCta {...defaultProps} />);
      const icon = container.querySelector(".lucide-bell");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("opens auth modal for non-authenticated users", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null as any,
        isLoading: false,
        isAuthenticated: false,
        signUp: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);
    });

    it("auth modal is not visible before clicking", () => {
      render(<BeachAlertCta {...defaultProps} />);
      expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
    });

    it("opens auth modal with source='beach-alert-cta' when button is clicked", () => {
      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });
      fireEvent.click(btn);
      expect(screen.getByTestId("auth-modal")).toBeInTheDocument();
      expect(screen.getByTestId("auth-modal")).toHaveAttribute(
        "data-source",
        "beach-alert-cta"
      );
    });
  });

  describe("stores pending action before opening auth modal", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null as any,
        isLoading: false,
        isAuthenticated: false,
        signUp: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);
    });

    it("calls setPendingAction with correct type, beachId, and beachName on click", () => {
      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });
      fireEvent.click(btn);
      expect(mockSetPendingAction).toHaveBeenCalledWith({
        type: "alert",
        beachId: defaultProps.beachId,
        beachName: defaultProps.beachName,
      });
    });
  });

  describe("shows success message for authenticated users", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: "u1", email: "test@example.com" } as any,
        session: null as any,
        isLoading: false,
        isAuthenticated: true,
        signUp: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);
    });

    it("does not show success message before clicking", () => {
      render(<BeachAlertCta {...defaultProps} />);
      expect(
        screen.queryByText(/alerts enabled/i)
      ).not.toBeInTheDocument();
    });

    it("shows success message after clicking for authenticated users", () => {
      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });
      fireEvent.click(btn);
      expect(
        screen.getByText(/alerts enabled for Blacks Beach/i)
      ).toBeInTheDocument();
    });

    it("does not open auth modal for authenticated users", () => {
      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });
      fireEvent.click(btn);
      expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
    });
  });
});
