import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PersonalizedForecastTeaser } from "@/components/beach-detail/personalized-forecast-teaser";
import { useAuth } from "@/context/auth-context";

jest.mock("@/context/auth-context");
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: (props: any) =>
    props.isOpen ? (
      <div data-testid="auth-modal" data-source={props.source} />
    ) : null,
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/ca/san-diego/blacks",
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("PersonalizedForecastTeaser", () => {
  const defaultProps = {
    beachId: "beach-123",
    beachName: "Blacks Beach",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("renders teaser card for non-authenticated users", () => {
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

    it("shows Your Surf Call heading", () => {
      render(<PersonalizedForecastTeaser {...defaultProps} />);
      expect(
        screen.getByText("Your Surf Call")
      ).toBeInTheDocument();
    });

    it("shows See Your Surf Call button", () => {
      render(<PersonalizedForecastTeaser {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /see your surf call/i })
      ).toBeInTheDocument();
    });
  });

  describe("renders nothing for authenticated users", () => {
    it("returns null when user is authenticated", () => {
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

      const { container } = render(
        <PersonalizedForecastTeaser {...defaultProps} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("shows three feature bullet points", () => {
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

    it("renders the wave difficulty benefit text", () => {
      render(<PersonalizedForecastTeaser {...defaultProps} />);
      expect(
        screen.getByText(/wave difficulty for your level/i)
      ).toBeInTheDocument();
    });

    it("renders the best time to paddle out benefit text", () => {
      render(<PersonalizedForecastTeaser {...defaultProps} />);
      expect(
        screen.getByText(/best time to paddle out/i)
      ).toBeInTheDocument();
    });

    it("renders the crowd preferences benefit text", () => {
      render(<PersonalizedForecastTeaser {...defaultProps} />);
      expect(
        screen.getByText(/crowd preferences applied/i)
      ).toBeInTheDocument();
    });
  });

  describe("opens auth modal when CTA is clicked", () => {
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

    it("auth modal is not visible initially", () => {
      render(<PersonalizedForecastTeaser {...defaultProps} />);
      expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
    });

    it("opens auth modal on CTA click", () => {
      render(<PersonalizedForecastTeaser {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /see your surf call/i });
      fireEvent.click(btn);
      expect(screen.getByTestId("auth-modal")).toBeInTheDocument();
    });

    it("passes correct source to auth modal", () => {
      render(<PersonalizedForecastTeaser {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /see your surf call/i });
      fireEvent.click(btn);
      expect(screen.getByTestId("auth-modal")).toHaveAttribute(
        "data-source",
        "personalized-forecast-teaser"
      );
    });
  });

  describe("applies className prop", () => {
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

    it("applies custom className to root element", () => {
      const { container } = render(
        <PersonalizedForecastTeaser
          {...defaultProps}
          className="my-custom-class"
        />
      );
      expect(container.firstChild).toHaveClass("my-custom-class");
    });
  });
});
