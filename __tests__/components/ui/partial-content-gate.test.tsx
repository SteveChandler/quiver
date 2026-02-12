/**
 * Unit Tests for PartialContentGate Component
 *
 * Tests the partial content gate (authentication wall):
 * - Rendering conditional on auth state
 * - Rendering conditional on content preview threshold
 * - CTA text with correct remaining count
 * - Sign Up and Log In interactions
 * - Analytics tracking (view, click)
 * - Auth modal integration
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PartialContentGate } from "@/components/ui/partial-content-gate";

// Mock dependencies
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("@/lib/analytics/engagement-tracking", () => ({
  trackPartialGateViewed: jest.fn(),
  trackPartialGateSignupClick: jest.fn(),
}));

jest.mock("@/lib/analytics/auth-events", () => ({
  trackAuthModalOpened: jest.fn(),
}));

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({
    isOpen,
    onClose,
    mode,
    source,
    returnTo,
  }: {
    isOpen: boolean;
    onClose: () => void;
    mode: string;
    source: string;
    returnTo: string;
  }) =>
    isOpen ? (
      <div data-testid="auth-modal">
        <div data-testid="auth-modal-mode">{mode}</div>
        <div data-testid="auth-modal-source">{source}</div>
        <div data-testid="auth-modal-return-to">{returnTo}</div>
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    size?: string;
  }) => (
    <button onClick={onClick} data-size={size}>
      {children}
    </button>
  ),
}));

jest.mock("lucide-react", () => ({
  Sparkles: ({ className }: { className?: string }) => (
    <svg data-testid="sparkles-icon" className={className} />
  ),
}));

describe("PartialContentGate", () => {
  const { useAuth } = require("@/context/auth-context");
  const { usePathname } = require("next/navigation");
  const {
    trackPartialGateViewed,
    trackPartialGateSignupClick,
  } = require("@/lib/analytics/engagement-tracking");
  const { trackAuthModalOpened } = require("@/lib/analytics/auth-events");

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    useAuth.mockReturnValue({
      user: null,
      isLoading: false,
    });
    usePathname.mockReturnValue("/test-page");

    // Mock IntersectionObserver
    global.IntersectionObserver = class IntersectionObserver {
      constructor(
        public callback: IntersectionObserverCallback,
        public options?: IntersectionObserverInit
      ) {}
      observe() {
        // Immediately trigger intersection
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as any
        );
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds = [];
    } as any;
  });

  describe("Rendering Conditions", () => {
    it("returns null when user is authenticated", () => {
      useAuth.mockReturnValue({
        user: { id: "user-1" },
        isLoading: false,
      });

      const { container } = render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("returns null when isLoading is true", () => {
      useAuth.mockReturnValue({
        user: null,
        isLoading: true,
      });

      const { container } = render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("returns null when totalCount <= previewCount", () => {
      const { container } = render(
        <PartialContentGate
          contentType="beaches"
          totalCount={3}
          previewCount={3}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("returns null when totalCount < previewCount", () => {
      const { container } = render(
        <PartialContentGate
          contentType="beaches"
          totalCount={2}
          previewCount={3}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders gate when user not authenticated and totalCount > previewCount", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(screen.getByText(/Sign up to see/i)).toBeInTheDocument();
    });
  });

  describe("CTA Text", () => {
    it("shows correct remaining count text", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(screen.getByText("Sign up to see 7 more beaches")).toBeInTheDocument();
    });

    it("shows correct content type in CTA text", () => {
      render(
        <PartialContentGate
          contentType="surf spots"
          totalCount={15}
          previewCount={5}
        />
      );

      expect(
        screen.getByText("Sign up to see 10 more surf spots")
      ).toBeInTheDocument();
    });

    it("handles singular remaining count", () => {
      render(
        <PartialContentGate
          contentType="sessions"
          totalCount={4}
          previewCount={3}
        />
      );

      expect(screen.getByText("Sign up to see 1 more sessions")).toBeInTheDocument();
    });

    it("handles large remaining count", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={100}
          previewCount={5}
        />
      );

      expect(screen.getByText("Sign up to see 95 more beaches")).toBeInTheDocument();
    });
  });

  describe("Button Rendering", () => {
    it("renders 'Sign Up Free' button", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(screen.getByText("Sign Up Free")).toBeInTheDocument();
    });

    it("Sign Up button has Sparkles icon", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(screen.getByTestId("sparkles-icon")).toBeInTheDocument();
    });

    it("renders 'Log in' link", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(screen.getByText("Log in")).toBeInTheDocument();
    });

    it("renders 'Already have an account?' text", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(screen.getByText(/Already have an account?/i)).toBeInTheDocument();
    });
  });

  describe("Sign Up Button Interaction", () => {
    it("opens auth modal on Sign Up button click", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const signUpButton = screen.getByText("Sign Up Free");
      fireEvent.click(signUpButton);

      expect(screen.getByTestId("auth-modal")).toBeInTheDocument();
    });

    it("auth modal opens in signup mode", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const signUpButton = screen.getByText("Sign Up Free");
      fireEvent.click(signUpButton);

      expect(screen.getByTestId("auth-modal-mode")).toHaveTextContent("signup");
    });

    it("tracks signup click with correct content type", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const signUpButton = screen.getByText("Sign Up Free");
      fireEvent.click(signUpButton);

      expect(trackPartialGateSignupClick).toHaveBeenCalledWith("beaches");
    });

    it("tracks auth modal opened event", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const signUpButton = screen.getByText("Sign Up Free");
      fireEvent.click(signUpButton);

      expect(trackAuthModalOpened).toHaveBeenCalledWith({
        mode: "signup",
        source: "partial-gate-beaches",
      });
    });

    it("auth modal has correct source", () => {
      render(
        <PartialContentGate
          contentType="surf spots"
          totalCount={10}
          previewCount={3}
        />
      );

      const signUpButton = screen.getByText("Sign Up Free");
      fireEvent.click(signUpButton);

      expect(screen.getByTestId("auth-modal-source")).toHaveTextContent(
        "partial-gate-surf spots"
      );
    });

    it("auth modal has correct returnTo path", () => {
      usePathname.mockReturnValue("/discover");

      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const signUpButton = screen.getByText("Sign Up Free");
      fireEvent.click(signUpButton);

      expect(screen.getByTestId("auth-modal-return-to")).toHaveTextContent(
        "/discover"
      );
    });
  });

  describe("Log In Link Interaction", () => {
    it("opens auth modal on Log in click", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const loginLink = screen.getByText("Log in");
      fireEvent.click(loginLink);

      expect(screen.getByTestId("auth-modal")).toBeInTheDocument();
    });

    it("auth modal opens in login mode", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const loginLink = screen.getByText("Log in");
      fireEvent.click(loginLink);

      expect(screen.getByTestId("auth-modal-mode")).toHaveTextContent("login");
    });

    it("does not track signup click for login link", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const loginLink = screen.getByText("Log in");
      fireEvent.click(loginLink);

      expect(trackPartialGateSignupClick).not.toHaveBeenCalled();
    });

    it("tracks auth modal opened event for login", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const loginLink = screen.getByText("Log in");
      fireEvent.click(loginLink);

      expect(trackAuthModalOpened).toHaveBeenCalledWith({
        mode: "login",
        source: "partial-gate-beaches",
      });
    });
  });

  describe("Auth Modal State Management", () => {
    it("modal closes when onClose is called", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      // Open modal
      const signUpButton = screen.getByText("Sign Up Free");
      fireEvent.click(signUpButton);

      expect(screen.getByTestId("auth-modal")).toBeInTheDocument();

      // Close modal
      const closeButton = screen.getByText("Close Modal");
      fireEvent.click(closeButton);

      expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
    });

    it("can switch between signup and login modes", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      // Open in signup mode
      const signUpButton = screen.getByText("Sign Up Free");
      fireEvent.click(signUpButton);
      expect(screen.getByTestId("auth-modal-mode")).toHaveTextContent("signup");

      // Close modal
      const closeButton = screen.getByText("Close Modal");
      fireEvent.click(closeButton);

      // Open in login mode
      const loginLink = screen.getByText("Log in");
      fireEvent.click(loginLink);
      expect(screen.getByTestId("auth-modal-mode")).toHaveTextContent("login");
    });
  });

  describe("Analytics Tracking", () => {
    it("tracks gate viewed event when rendered", async () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      await waitFor(() => {
        expect(trackPartialGateViewed).toHaveBeenCalledWith("beaches", 10);
      });
    });

    it("does not track view when user is authenticated", () => {
      useAuth.mockReturnValue({
        user: { id: "user-1" },
        isLoading: false,
      });

      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(trackPartialGateViewed).not.toHaveBeenCalled();
    });

    it("does not track view when still loading", () => {
      useAuth.mockReturnValue({
        user: null,
        isLoading: true,
      });

      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(trackPartialGateViewed).not.toHaveBeenCalled();
    });

    it("tracks view only once even with re-renders", async () => {
      const { rerender } = render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      await waitFor(() => {
        expect(trackPartialGateViewed).toHaveBeenCalledTimes(1);
      });

      // Re-render with same props
      rerender(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      // Should still be called only once
      expect(trackPartialGateViewed).toHaveBeenCalledTimes(1);
    });
  });

  describe("Custom ClassName", () => {
    it("applies custom className to wrapper", () => {
      const { container } = render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
          className="custom-class"
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("custom-class");
    });

    it("applies default empty className when not provided", () => {
      const { container } = render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(container.firstChild).toBeTruthy();
    });
  });

  describe("Children Rendering", () => {
    it("component does not use children prop", () => {
      // Note: PartialContentGate renders a gradient overlay and CTA
      // It does not accept or render children - the gated content
      // is rendered separately in the parent component
      const { container } = render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      expect(container.firstChild).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("handles zero previewCount", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={0}
        />
      );

      expect(screen.getByText("Sign up to see 10 more beaches")).toBeInTheDocument();
    });

    it("handles very large counts", () => {
      render(
        <PartialContentGate
          contentType="beaches"
          totalCount={1000}
          previewCount={5}
        />
      );

      expect(
        screen.getByText("Sign up to see 995 more beaches")
      ).toBeInTheDocument();
    });

    it("handles different content type strings", () => {
      render(
        <PartialContentGate
          contentType="amazing surf sessions"
          totalCount={20}
          previewCount={3}
        />
      );

      expect(
        screen.getByText("Sign up to see 17 more amazing surf sessions")
      ).toBeInTheDocument();
    });
  });

  describe("Gradient Overlay", () => {
    it("renders gradient overlay element", () => {
      const { container } = render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const gradient = container.querySelector(
        ".bg-gradient-to-t.from-white"
      );
      expect(gradient).toBeInTheDocument();
    });

    it("gradient overlay has correct height", () => {
      const { container } = render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const gradient = container.querySelector(".h-24");
      expect(gradient).toBeInTheDocument();
    });

    it("gradient overlay is pointer-events-none", () => {
      const { container } = render(
        <PartialContentGate
          contentType="beaches"
          totalCount={10}
          previewCount={3}
        />
      );

      const gradient = container.querySelector(".pointer-events-none");
      expect(gradient).toBeInTheDocument();
    });
  });
});
