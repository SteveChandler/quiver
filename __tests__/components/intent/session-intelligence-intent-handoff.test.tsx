import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionIntelligenceIntentHandoff } from "@/components/intent/session-intelligence-intent-handoff";

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
  return () => document.removeEventListener("click", handler, { capture: true });
}

describe("SessionIntelligenceIntentHandoff", () => {
  let restoreAnchorNavigation: (() => void) | null = null;

  beforeEach(() => {
    mockTrack.mockClear();
    restoreAnchorNavigation = preventAnchorNavigation();
  });

  afterEach(() => {
    restoreAnchorNavigation?.();
    restoreAnchorNavigation = null;
  });

  it("renders crawlable links and Brand-Vault sticker assets", () => {
    render(
      <SessionIntelligenceIntentHandoff
        cityName="San Diego"
        citySlug="san-diego"
        stateSlug="ca"
        bestTimeToSurfUrl="/best-time-to-surf/san-diego"
      />
    );

    const region = screen.getByRole("region", {
      name: /turn this guide into today's surf call/i,
    });
    const links = within(region).getAllByRole("link");

    expect(links).toHaveLength(4);
    expect(within(region).getByRole("link", { name: /open live san diego conditions/i })).toHaveAttribute("href", "/ca/san-diego");
    expect(within(region).getByRole("link", { name: /check the tide window/i })).toHaveAttribute("href", "/tide/san-diego");
    expect(within(region).getByRole("link", { name: /compare seasonal windows/i })).toHaveAttribute("href", "/best-time-to-surf/san-diego");
    expect(within(region).getByRole("link", { name: /scan the regional forecast/i })).toHaveAttribute("href", "/forecast");

    const sticker = within(region).getByAltText("");
    expect(sticker).toHaveAttribute(
      "src",
      expect.stringContaining("/images/quiver-stickers/spot-tide-window.png")
    );
  });

  it("tracks SEO intent handoff clicks with route context", async () => {
    const user = userEvent.setup();

    render(
      <SessionIntelligenceIntentHandoff
        cityName="San Diego"
        citySlug="san-diego"
        stateSlug="ca"
        bestTimeToSurfUrl="/best-time-to-surf/san-diego"
      />
    );

    await user.click(
      screen.getByRole("link", { name: /open live san diego conditions/i })
    );

    expect(mockTrack).toHaveBeenCalledWith("seo_intent_page_window_clicked", {
      metadata: expect.objectContaining({
        surface: "intent_handoff",
        city_name: "San Diego",
        city_slug: "san-diego",
        state_slug: "ca",
        target_href: "/ca/san-diego",
        link_label: "Open live San Diego conditions",
        link_index: 0,
      }),
      debounceMs: 0,
    });
  });
});
