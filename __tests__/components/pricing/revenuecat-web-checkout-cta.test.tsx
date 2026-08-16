import { render, screen } from "@testing-library/react";

let mockAuthState: { user: { id: string } | null; isLoading: boolean } = {
  user: { id: "user-123" },
  isLoading: false,
};

jest.mock("@/context/auth-context", () => ({
  useAuth: () => mockAuthState,
}));

describe("RevenueCatWebCheckoutCta", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL =
      "https://pay.rev.cat/quiver-pro";
    mockAuthState = { user: { id: "user-123" }, isLoading: false };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("links an authenticated user to an identified checkout", async () => {
    const { RevenueCatWebCheckoutCta } = await import(
      "@/components/pricing/revenuecat-web-checkout-cta"
    );

    render(<RevenueCatWebCheckoutCta />);

    expect(screen.getByTestId("revenuecat-web-checkout-cta")).toHaveAttribute(
      "href",
      "https://pay.rev.cat/quiver-pro/user-123",
    );
  });

  it("requires sign-in before exposing the checkout link", async () => {
    mockAuthState = { user: null, isLoading: false };
    const { RevenueCatWebCheckoutCta } = await import(
      "@/components/pricing/revenuecat-web-checkout-cta"
    );

    render(<RevenueCatWebCheckoutCta />);

    expect(
      screen.getByTestId("revenuecat-web-checkout-sign-in"),
    ).toHaveAttribute("href", "/auth/sign-in?redirectTo=%2Fplans");
    expect(
      screen.queryByTestId("revenuecat-web-checkout-cta"),
    ).not.toBeInTheDocument();
  });
});
