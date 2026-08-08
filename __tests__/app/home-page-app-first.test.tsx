import { render, screen } from "@testing-library/react";

const mockHeadersGet = jest.fn();

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({
    get: mockHeadersGet,
  })),
}));

jest.mock("@/components/landing-page/auth-aware-landing-wrapper", () => ({
  AuthAwareLandingWrapper: ({
    initialPlatform,
    appFirst,
  }: {
    initialPlatform?: string;
    appFirst?: boolean;
  }) => (
    <div
      data-testid="auth-aware-wrapper"
      data-platform={initialPlatform}
      data-app-first={String(appFirst)}
    />
  ),
}));

jest.mock("@/components/landing-page/landing-page-ssr-section", () => ({
  LandingPageSSRSection: () => <section data-testid="landing-ssr-section" />,
}));

import Home from "@/app/page";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

describe("home page app-first landing shell", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.APP_FIRST_LANDING_ENABLED;
  });

  it("keeps the SSR beach section and never reads request headers", () => {
    // Reading the request's user-agent here opted the whole route out of
    // static generation, so `export const revalidate` never applied and every
    // visit re-rendered the page. Platform is now resolved client-side; if
    // this page starts reading headers again the route silently goes dynamic.
    mockHeadersGet.mockReturnValue(IPHONE_UA);

    render(Home());

    expect(screen.getByTestId("auth-aware-wrapper")).toHaveAttribute(
      "data-app-first",
      "true",
    );
    expect(screen.getByTestId("landing-ssr-section")).toBeInTheDocument();
    expect(mockHeadersGet).not.toHaveBeenCalled();
  });

  it("passes the rollback flag state into the client wrapper", () => {
    process.env.APP_FIRST_LANDING_ENABLED = "false";

    render(Home());

    expect(screen.getByTestId("auth-aware-wrapper")).toHaveAttribute(
      "data-app-first",
      "false",
    );
  });
});
