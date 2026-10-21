import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";

import type { CamBeachWithRegion } from "@/actions/beach/cam-actions";
import { IphoneAppBannerGate } from "@/components/app-store/iphone-app-banner-gate";
import { SeoLocationPage } from "@/components/seo/funnel/SeoLocationPage";
import { trackAppHandoffView } from "@/lib/analytics/app-handoff-tracking";
import { track as trackPostHog } from "@/lib/analytics";
import { trackIosAppCtaClick } from "@/lib/analytics/ios-app-cta-tracking";
import { getSeoFunnelPageByTypeAndSlug, type SeoPageConfig } from "@/lib/seo/funnel-pages";

let pathname = "/surf-cams/san-diego";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));

const mockTrack = jest.fn();
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: null, isLoading: false }),
  useOptionalAuth: () => ({ user: null, isLoading: false }),
}));
jest.mock("@/lib/analytics", () => ({ track: jest.fn() }));
jest.mock("@/lib/analytics/app-handoff-tracking", () => ({
  trackAppHandoffView: jest.fn(),
}));
jest.mock("@/lib/analytics/ios-app-cta-tracking", () => ({
  trackIosAppCtaClick: jest.fn(),
}));
jest.mock("@/hooks/use-reduced-motion", () => ({ useReducedMotion: () => false }));
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt = "" }: { alt?: string }) => <img alt={alt} />,
}));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  // Resolve the lazy bar synchronously; its loader is covered by the bar's own test.
  default: () => require("@/components/app-store/install-bar").InstallBar,
}));

jest.mock("@/components/ui/sticky-signup-bar", () => ({
  StickySignupBar: ({ source }: { source: string }) => (
    <div data-testid="sticky-signup-bar" data-source={source} />
  ),
}));
jest.mock("@/components/app-store/iphone-app-banner", () => ({
  IphoneAppBanner: () => <div data-testid="iphone-app-banner" />,
}));
jest.mock("@/components/cams/cam-grid", () => ({
  CamGrid: ({ beaches }: { beaches: unknown[] }) => (
    <div data-testid="cam-grid" data-count={beaches.length} />
  ),
}));
jest.mock("@/actions/beginner/beginner-actions", () => ({
  getBeginnerConditionsData: jest.fn(async () => null),
}));
jest.mock("@/components/beginner/beginner-session-decision", () => ({
  BeginnerSessionDecision: () => null,
}));
jest.mock("@/components/seo/alert-capture-cta", () => ({ AlertCaptureCta: () => null }));
jest.mock("@/components/seo/breadcrumb-schema", () => ({
  BreadcrumbStructuredData: () => null,
}));
jest.mock("@/components/seo/web-page-schema", () => ({ WebPageSchema: () => null }));
jest.mock("@/components/seo/funnel/JsonLd", () => ({ JsonLd: () => null }));
jest.mock("@/components/seo/funnel/SeoHero", () => ({ SeoHero: () => null }));
jest.mock("@/components/seo/funnel/SurfDecisionCard", () => ({ SurfDecisionCard: () => null }));
jest.mock("@/components/seo/funnel/BoardRecommendationCard", () => ({
  BoardRecommendationCard: () => null,
}));
jest.mock("@/components/seo/funnel/NearbySpots", () => ({ NearbySpots: () => null }));
jest.mock("@/components/seo/funnel/InternalLinkCluster", () => ({
  InternalLinkCluster: () => null,
}));
jest.mock("@/components/seo/funnel/SeoFaq", () => ({ SeoFaq: () => null }));
jest.mock("@/components/seo/funnel/QuiverSeoCta", () => ({ QuiverSeoCta: () => null }));

const IPHONE_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const HANDOFF = "content-page-app-handoff-cta-surf_cams";
const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED;
const originalIntersectionObserver = globalThis.IntersectionObserver;

const CAMERAS = [
  { id: "ob", name: "Ocean Beach", city: "San Diego", state: "CA", regionSlug: "southern-california" },
  { id: "pb", name: "Pacific Beach", city: "San Diego", state: "CA", regionSlug: "southern-california" },
] as unknown as CamBeachWithRegion[];

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: userAgent });
}

function funnelPage(type: SeoPageConfig["type"], slug: string): SeoPageConfig {
  const page = getSeoFunnelPageByTypeAndSlug(type, slug);
  if (!page) throw new Error(`Missing ${type}/${slug} seed`);
  return page;
}

async function renderPage(
  type: SeoPageConfig["type"] = "surf-cams",
  slug = "san-diego",
): Promise<ReturnType<typeof render>> {
  const ui = (await SeoLocationPage({ page: funnelPage(type, slug), cameras: CAMERAS })) as ReactElement;
  return render(
    <>
      <IphoneAppBannerGate />
      {ui}
    </>,
  );
}

function intersectImmediately(): void {
  const observer = jest.fn((callback: IntersectionObserverCallback) => {
    const instance = {
      observe: () =>
        callback(
          [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
          instance as unknown as IntersectionObserver,
        ),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    };
    return instance as unknown as IntersectionObserver;
  });
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, writable: true, value: observer });
  Object.defineProperty(window, "IntersectionObserver", { configurable: true, writable: true, value: observer });
}

beforeEach(() => {
  jest.clearAllMocks();
  pathname = "/surf-cams/san-diego";
  window.localStorage.clear();
  Object.defineProperty(window, "scrollY", { value: 900, configurable: true, writable: true });
  delete process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED;
});

afterEach(() => {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: originalIntersectionObserver,
  });
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: originalIntersectionObserver,
  });
  if (ORIGINAL_FLAG === undefined) delete process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED;
  else process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = ORIGINAL_FLAG;
});

describe("SeoLocationPage install CTA on /surf-cams", () => {
  it("renders one handoff right after the cam grid with its own placement", async () => {
    setUserAgent(DESKTOP_UA);
    await renderPage();

    const ctas = screen.getAllByTestId(HANDOFF);
    expect(ctas).toHaveLength(1);
    const [cta] = ctas;
    expect(cta).toHaveAttribute("data-surface", "surf_cams");
    expect(cta).toHaveAttribute("data-placement", "after_cam_grid");
    expect(
      screen.getByTestId("cam-grid").compareDocumentPosition(cta) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const href = new URL(screen.getByTestId("app_handoff_surf_cams_after_cam_grid-link").getAttribute("href") ?? "");
    expect(href.pathname).toBe("/app/handoff");
    expect(href.searchParams.get("source")).toBe("content-surf-cams-san-diego");
    expect(href.searchParams.get("surface")).toBe("surf_cams");
    expect(href.searchParams.get("placement")).toBe("after_cam_grid");
    expect(href.searchParams.get("target")).toBe("surf-cams:san-diego");
  });

  it("emits the handoff view with the placement once the CTA is on screen", async () => {
    intersectImmediately();
    setUserAgent(ANDROID_UA);
    await renderPage();

    expect(trackAppHandoffView).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "content-surf-cams-san-diego",
        surface: "surf_cams",
        placement: "after_cam_grid",
        stage: "content_cta",
      }),
    );
    expect(mockTrack).toHaveBeenCalledWith(
      "cta_impression",
      expect.objectContaining({
        metadata: expect.objectContaining({
          cta_id: "app_handoff_surf_cams_after_cam_grid",
          surface: "surf_cams",
          placement: "after_cam_grid",
        }),
      }),
    );
  });

  it("writes a cta_click with the placement and a fresh handoff id on tap", async () => {
    setUserAgent(ANDROID_UA);
    await renderPage();

    const link = screen.getByTestId("app_handoff_surf_cams_after_cam_grid-link");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);

    expect(mockTrack).toHaveBeenCalledWith(
      "cta_click",
      expect.objectContaining({
        metadata: expect.objectContaining({
          cta_family: "app_handoff",
          surface: "surf_cams",
          placement: "after_cam_grid",
          source: "content-surf-cams-san-diego",
          handoff_id: expect.any(String),
        }),
      }),
    );
    const { handoff_id: handoffId } = mockTrack.mock.calls.find(([event]) => event === "cta_click")?.[1].metadata;
    expect(new URL(link.getAttribute("href") ?? "").searchParams.get("handoff_id")).toBe(handoffId);
  });

  it("keeps the handoff off other funnel page types", async () => {
    pathname = "/longboard/encinitas";
    setUserAgent(ANDROID_UA);
    await renderPage("longboard", "encinitas");

    expect(screen.queryByTestId(HANDOFF)).not.toBeInTheDocument();
    expect(screen.getByTestId("sticky-signup-bar")).toBeInTheDocument();
  });

  it.each([
    ["Android", ANDROID_UA],
    ["desktop", DESKTOP_UA],
  ])("keeps the in-page handoff and the signup bar on %s with the bar on", async (_name, userAgent) => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(userAgent);
    await renderPage();
    await act(async () => {});

    expect(screen.getByTestId(HANDOFF)).toBeInTheDocument();
    expect(screen.getByTestId("sticky-signup-bar")).toHaveAttribute(
      "data-source",
      "seo-funnel-surf-cams-san-diego",
    );
    expect(screen.queryByTestId("install-bar")).not.toBeInTheDocument();
  });

  it.each([
    ["Safari", IPHONE_SAFARI_UA],
    ["Chrome", IPHONE_CHROME_UA],
  ])("gives iPhone %s one ask: the install bar, no signup bar, handoff or banner", async (_name, userAgent) => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(userAgent);
    await renderPage();

    await waitFor(() => expect(screen.getByTestId("install-bar")).toBeInTheDocument());
    expect(screen.queryByTestId("sticky-signup-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId(HANDOFF)).not.toBeInTheDocument();
    expect(screen.queryByTestId("iphone-app-banner")).not.toBeInTheDocument();
    expect(screen.getByText("Forecast and alerts for San Diego")).toBeInTheDocument();
  });

  it("tracks the install bar's view and tap under the surf_cams surface", async () => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(IPHONE_CHROME_UA);
    await renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("install-bar")).toHaveAttribute("data-visible", "true"),
    );
    expect(trackPostHog).toHaveBeenCalledWith("install_bar_view", {
      cta_family: "install_bar",
      surface: "surf_cams",
      pathname: "/surf-cams/san-diego",
    });

    const link = screen.getByRole("link", { name: "Get the app" });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);

    expect(trackIosAppCtaClick).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "surf-cams-san-diego",
        surface: "surf_cams",
        placement: "install_bar",
        handoff_id: expect.any(String),
      }),
    );
  });

  it("keeps today's asks with the bar off: banner for iPhone Chrome, handoff and signup bar", async () => {
    setUserAgent(IPHONE_CHROME_UA);
    await renderPage();

    await waitFor(() => expect(screen.getByTestId("iphone-app-banner")).toBeInTheDocument());
    expect(screen.getByTestId(HANDOFF)).toBeInTheDocument();
    expect(screen.getByTestId("sticky-signup-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("install-bar")).not.toBeInTheDocument();
  });
});
