import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Providers } from "@/components/providers";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));
jest.mock("next/dynamic", () => () => () => null);

function mockPassthrough({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
jest.mock("@/context/auth-context", () => ({
  AuthProvider: mockPassthrough,
  useAuth: () => ({ user: null }),
}));
jest.mock("@/context/profile-context", () => ({ ProfileProvider: mockPassthrough }));
jest.mock("@/context/location-context", () => ({ LocationProvider: mockPassthrough }));
jest.mock("@/components/analytics/analytics-loader", () => ({ AnalyticsLoader: () => null }));
jest.mock("@/components/analytics/posthog-provider", () => ({ PostHogProvider: () => null }));
jest.mock("@/components/chunk-error-handler", () => ({ ChunkErrorHandler: () => null }));
jest.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
jest.mock("@/components/app-header", () => ({ AppHeader: () => <header /> }));
jest.mock("@/components/app-store/iphone-app-banner-gate", () => ({ IphoneAppBannerGate: () => null }));
jest.mock("@/components/profile/timezone-capture", () => ({ TimezoneCapture: () => null }));

// Only the non-landing branch (AuthenticatedAppContent) renders this inline script,
// which is also how the bad cached "/" HTML was spotted on prod.
function rendersAppBranch(pathname: string): boolean {
  (usePathname as jest.Mock).mockReturnValue(pathname);
  const { container, unmount } = render(
    <Providers>
      <p>page</p>
    </Providers>,
  );
  const appBranch = [...container.querySelectorAll("script")].some((script) =>
    script.innerHTML.includes("window.confetti"),
  );
  expect(container.querySelector("main#main-content")?.textContent).toBe("page");
  unmount();
  return appBranch;
}

describe("Providers layout branch", () => {
  it("uses the landing layout on / and the app layout elsewhere", () => {
    expect(rendersAppBranch("/")).toBe(false);
    expect(rendersAppBranch("/map")).toBe(true);
  });

  // Next's ISR revalidation renders "/" with pathname "/index". Choosing the app
  // layout there made the cached HTML disagree with hydration and left the site
  // footer orphaned above the /map header (Oct 2026).
  it("treats the ISR root pathname /index as the landing page", () => {
    expect(rendersAppBranch("/index")).toBe(false);
  });
});
