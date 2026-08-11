import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppDeepLinkCTA } from "@/components/session-intelligence";
import { IOS_APP_STORE_WEB_REDIRECT_PATH } from "@/lib/constants/app-store";
import type { SurfWindowLinks } from "@/types/session-intelligence";

const mockTrack = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

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
});
