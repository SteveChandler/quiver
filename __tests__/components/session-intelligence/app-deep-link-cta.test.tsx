import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppDeepLinkCTA } from "@/components/session-intelligence";
import { IOS_APP_STORE_WEB_REDIRECT_PATH } from "@/lib/constants/app-store";
import {
  HandoffRecommendationMode,
  HandoffRecommendationVerdict,
  HandoffSourceSurface,
  type HandoffContext,
} from "@/types/exact-handoff";
import type { SurfWindowLinks } from "@/types/session-intelligence";

const mockTrack = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("@/components/beach-follow", () => ({
  BeachFollowPilot: ({ beachName }: { beachName: string }) => (
    <button>Follow {beachName}</button>
  ),
}));

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const HANDOFF_ID = "33333333-3333-4333-8333-333333333333";
const EXACT_CONTEXT: HandoffContext = {
  v: 1,
  beachId: BEACH_ID,
  slug: "ocean-beach",
  windowId: "2026-08-25T14:00:00.000Z",
  sourceSurface: HandoffSourceSurface.SurfComparison,
  generatedAt: "2026-08-25T12:00:00.000Z",
  expiresAt: "2026-08-25T12:30:00.000Z",
  priorRecommendation: {
    recommendationId: `beach:${BEACH_ID}:2026-08-25T14:00:00.000Z`,
    mode: HandoffRecommendationMode.Best,
    verdict: HandoffRecommendationVerdict.Go,
  },
};

const GENERAL_FOLLOW = {
  beachId: BEACH_ID,
  beachName: "Ocean Beach",
  pageType: "beach_detail" as const,
};

const EXPLICIT_SURF = {
  explicitChoice: "surfing" as const,
  signals: { utilityPageViewCount: 1, surfSpecificSignalCount: 0 },
};

function preventAnchorNavigation(): () => void {
  const handler = (event: MouseEvent): void => {
    if (event.target instanceof Element && event.target.closest("a")) {
      event.preventDefault();
    }
  };
  document.addEventListener("click", handler, { capture: true });
  return () =>
    document.removeEventListener("click", handler, { capture: true });
}

function makeLinks(overrides: Partial<SurfWindowLinks> = {}): SurfWindowLinks {
  return {
    appDeepLink: "/app/spot/ocean-beach?window=window-1",
    universalLink:
      "https://www.quiversurf.app/app/spot/ocean-beach?window=window-1",
    canonicalWebUrl: "https://www.quiversurf.app/ca/san-diego/ocean-beach",
    ...overrides,
  };
}

describe("AppDeepLinkCTA", () => {
  let restoreAnchorNavigation: (() => void) | null = null;

  beforeEach(() => {
    mockTrack.mockClear();
    restoreAnchorNavigation = preventAnchorNavigation();
  });

  afterEach(() => {
    restoreAnchorNavigation?.();
    restoreAnchorNavigation = null;
  });

  it("prefers universal links", () => {
    render(<AppDeepLinkCTA links={makeLinks()} />);

    expect(
      screen.getByRole("link", { name: "Open this window in Quiver" }),
    ).toHaveAttribute(
      "href",
      "https://www.quiversurf.app/app/spot/ocean-beach?window=window-1",
    );
  });

  it("falls back to app deep link when universal link is unavailable", () => {
    render(<AppDeepLinkCTA links={makeLinks({ universalLink: null })} />);

    expect(
      screen.getByRole("link", { name: "Open this window in Quiver" }),
    ).toHaveAttribute("href", "/app/spot/ocean-beach?window=window-1");
  });

  it("falls back to App Store URL when recommendation links are unavailable", () => {
    render(
      <AppDeepLinkCTA
        links={makeLinks({
          appDeepLink: null,
          universalLink: null,
        })}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Open App Store" }),
    ).toHaveAttribute("href", IOS_APP_STORE_WEB_REDIRECT_PATH);
  });

  it("tracks surf-window and app-deeplink clicks with fallback context", async () => {
    const user = userEvent.setup();
    const targetHref =
      "https://www.quiversurf.app/app/spot/ocean-beach?window=window-1";

    render(
      <AppDeepLinkCTA
        links={makeLinks()}
        tracking={{
          surface: "spot_page",
          beachId: "beach-1",
          beachSlug: "ocean-beach",
          beachName: "Ocean Beach",
          windowId: "window-1",
          rank: 1,
        }}
      />,
    );

    await user.click(
      screen.getByRole("link", { name: "Open this window in Quiver" }),
    );

    const expectedPayload = {
      beachId: "beach-1",
      metadata: expect.objectContaining({
        surface: "spot_page",
        beach_id: "beach-1",
        beach_slug: "ocean-beach",
        beach_name: "Ocean Beach",
        window_id: "window-1",
        rank: 1,
        target_href: targetHref,
        link_type: "universal_link",
        fallback_to_app_store: false,
      }),
      debounceMs: 0,
    };
    expect(mockTrack).toHaveBeenCalledWith(
      "surf_window_click",
      expectedPayload,
    );
    expect(mockTrack).toHaveBeenCalledWith(
      "app_deeplink_clicked",
      expectedPayload,
    );
  });

  it("tracks App Store fallback clicks", async () => {
    const user = userEvent.setup();

    render(
      <AppDeepLinkCTA
        links={makeLinks({ appDeepLink: null, universalLink: null })}
        tracking={{
          surface: "dev_preview",
          windowId: "window-1",
        }}
      />,
    );

    await user.click(screen.getByRole("link", { name: "Open App Store" }));

    expect(mockTrack).toHaveBeenCalledWith("app_deeplink_clicked", {
      metadata: expect.objectContaining({
        surface: "dev_preview",
        window_id: "window-1",
        target_href: IOS_APP_STORE_WEB_REDIRECT_PATH,
        link_type: "app_store",
        fallback_to_app_store: true,
      }),
      debounceMs: 0,
    });
  });

  it.each([
    ["explicit", EXPLICIT_SURF],
    ["inferred", {
      explicitChoice: null,
      signals: {
        utilityPageViewCount: 0,
        surfSpecificSignalCount: 0,
        spotComparison: true,
      },
    }],
  ])("renders an exact handoff for %s surf intent", (_label, intentEvidence) => {
    render(
      <AppDeepLinkCTA
        links={makeLinks()}
        handoff={EXACT_CONTEXT}
        handoffId={HANDOFF_ID}
        handoffSurface="beach_detail"
        intentEvidence={intentEvidence}
        generalFollow={GENERAL_FOLLOW}
        now={new Date("2026-08-25T12:15:00.000Z")}
      />,
    );

    const link = screen.getByRole("link", {
      name: "Open this exact call in Quiver",
    });
    const url = new URL(link.getAttribute("href")!);
    expect(url.pathname).toBe("/app/spot/ocean-beach");
    expect(url.searchParams.get("window")).toBe(EXACT_CONTEXT.windowId);
    expect(url.searchParams.get("handoff_id")).toBe(HANDOFF_ID);
    expect(url.searchParams.get("source")).toBe("exact_call");
    expect(url.searchParams.get("handoff_context")).toBe("exact_call");
    expect(JSON.parse(url.searchParams.get("context")!)).toEqual(EXACT_CONTEXT);
  });

  it.each([
    ["unknown", {
      explicitChoice: null,
      signals: { utilityPageViewCount: 1, surfSpecificSignalCount: 0 },
    }],
    ["explicit non-surf", {
      explicitChoice: "swimming" as const,
      signals: { utilityPageViewCount: 1, surfSpecificSignalCount: 3 },
    }],
  ])("keeps the existing general follow action primary for %s intent", (_label, intentEvidence) => {
    render(
      <AppDeepLinkCTA
        links={makeLinks()}
        handoff={EXACT_CONTEXT}
        handoffId={HANDOFF_ID}
        handoffSurface="beach_detail"
        intentEvidence={intentEvidence}
        generalFollow={GENERAL_FOLLOW}
      />,
    );

    expect(screen.getByRole("button", { name: "Follow Ocean Beach" })).toBeVisible();
    expect(screen.queryByText(/exact call/i)).not.toBeInTheDocument();
  });

  it.each([
    ["beach-only", null],
    ["expired", { ...EXACT_CONTEXT, expiresAt: "2026-08-25T12:30:00.000Z" }],
  ])("uses an honest beach-level handoff for %s context", (_label, handoff) => {
    render(
      <AppDeepLinkCTA
        links={makeLinks()}
        handoff={handoff}
        handoffId={HANDOFF_ID}
        handoffSurface="beach_detail"
        intentEvidence={EXPLICIT_SURF}
        generalFollow={GENERAL_FOLLOW}
        now={new Date("2026-08-25T13:00:00.000Z")}
      />,
    );

    const link = screen.getByRole("link", { name: "Open this beach in Quiver" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.pathname).toBe("/app/spot/ocean-beach");
    expect(url.searchParams.has("window")).toBe(false);
    expect(url.searchParams.has("context")).toBe(false);
    expect(url.searchParams.has("handoff_id")).toBe(false);
  });

  it("emits bounded exact-call start metadata without serialized context", async () => {
    const user = userEvent.setup();
    render(
      <AppDeepLinkCTA
        links={makeLinks()}
        handoff={EXACT_CONTEXT}
        handoffId={HANDOFF_ID}
        handoffSurface="beach_detail"
        intentEvidence={EXPLICIT_SURF}
        generalFollow={GENERAL_FOLLOW}
        now={new Date("2026-08-25T12:15:00.000Z")}
      />,
    );

    await user.click(screen.getByRole("link", { name: /exact call/i }));

    expect(mockTrack).not.toHaveBeenCalledWith(
      "app_deeplink_clicked",
      expect.anything(),
    );
  });
});
