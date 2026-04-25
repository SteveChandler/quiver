import { render, screen } from "@testing-library/react";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: null, isLoading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

jest.mock("@/hooks/use-search-referrer", () => ({
  useSearchReferrer: () => ({ isSearchReferral: false }),
}));

jest.mock("@/hooks/use-persisted-dismissal", () => ({
  usePersistedDismissal: () => ({ isDismissed: false, handleDismiss: jest.fn() }),
}));

jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSignupCtaClick: jest.fn(),
  trackSignupCtaView: jest.fn(),
}));

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: () => null,
}));

beforeEach(() => {
  Object.defineProperty(window, "scrollY", { value: 200, writable: true });
});

describe("StickySignupBar buttonClassName prop", () => {
  it("merges buttonClassName into the primary CTA button", () => {
    render(
      <StickySignupBar
        source="test-source"
        ctaText="Sign Up"
        buttonClassName="min-h-[48px]"
      />
    );
    window.dispatchEvent(new Event("scroll"));
    const btn = screen.getByTestId("sticky-signup-cta");
    expect(btn.className).toMatch(/min-h-\[48px\]/);
  });

  it("works without buttonClassName (default behavior)", () => {
    render(<StickySignupBar source="test-source-2" ctaText="Sign Up" />);
    window.dispatchEvent(new Event("scroll"));
    const btn = screen.getByTestId("sticky-signup-cta");
    expect(btn.className).not.toMatch(/min-h-\[48px\]/);
  });
});
