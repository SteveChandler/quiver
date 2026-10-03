import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { InstallBar } from "@/components/app-store/install-bar";
import { track } from "@/lib/analytics";
import { trackIosAppCtaClick } from "@/lib/analytics/ios-app-cta-tracking";

jest.mock("@/lib/analytics", () => ({ track: jest.fn() }));
jest.mock("@/lib/analytics/ios-app-cta-tracking", () => ({
  trackIosAppCtaClick: jest.fn(),
  trackIosAppCtaView: jest.fn(),
}));

let reducedMotion = false;
jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => reducedMotion,
}));

const trackMock = track as jest.Mock;
const clickMock = trackIosAppCtaClick as jest.Mock;

function setScroll(y: number): void {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });
}

function renderBar(overrides: Partial<React.ComponentProps<typeof InstallBar>> = {}) {
  const onDismiss = jest.fn();
  const utils = render(
    <InstallBar
      surface="beach_detail"
      placeName="Blacks"
      valueLabel="2-3 ft"
      isTomorrow={false}
      source="beach-detail-blacks"
      pathname="/ca/san-diego/blacks"
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  return { onDismiss, ...utils };
}

beforeEach(() => {
  jest.clearAllMocks();
  reducedMotion = false;
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  setScroll(0);
  document.body.innerHTML = "";
  document.documentElement.style.scrollPaddingBottom = "";
});

describe("InstallBar", () => {
  it("stays hidden until the visitor scrolls past 60% of the viewport", async () => {
    renderBar();
    const bar = screen.getByTestId("install-bar");

    expect(bar).toHaveAttribute("data-visible", "false");
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(trackMock).not.toHaveBeenCalled();

    setScroll(479);
    fireEvent.scroll(window);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(bar).toHaveAttribute("data-visible", "false");

    setScroll(480);
    fireEvent.scroll(window);
    await waitFor(() => expect(bar).toHaveAttribute("data-visible", "true"));
    expect(bar).toHaveAttribute("aria-hidden", "false");
  });

  it("renders the copy and a handoff link, with accessible names", () => {
    setScroll(600);
    renderBar();

    const bar = screen.getByRole("complementary", { name: "Quiver iPhone app install" });
    expect(bar).toHaveTextContent("Now at Blacks: 2-3 ft");
    expect(bar).toHaveTextContent("Hourly forecast and alerts in the app");
    expect(bar).not.toHaveTextContent(/\bcall\b/i);

    const link = screen.getByRole("link", { name: "Get the app" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.origin + url.pathname).toBe("https://go.quiversurf.app/app/handoff");
    expect(url.searchParams.get("source")).toBe("beach-detail-blacks");
    expect(url.searchParams.get("surface")).toBe("beach_detail");
    expect(url.searchParams.get("placement")).toBe("install_bar");
    expect(link).not.toHaveAttribute("target");
    expect(screen.getByRole("button", { name: "Dismiss app install bar" })).toBeInTheDocument();
  });

  it("tracks a tap through trackIosAppCtaClick before navigation, with a fresh handoff id", () => {
    setScroll(600);
    renderBar({ surface: "water_temp", source: "water-temp-san-diego" });

    const link = screen.getByRole("link", { name: "Get the app" });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);

    expect(clickMock).toHaveBeenCalledTimes(1);
    const metadata = clickMock.mock.calls[0][0];
    expect(metadata).toMatchObject({
      source: "water-temp-san-diego",
      surface: "water_temp",
      placement: "install_bar",
      cta_text: "Get the app",
      link_kind: "handoff",
    });
    expect(metadata.handoff_id).toEqual(expect.any(String));
    expect(metadata.destination_url).toContain(`handoff_id=${metadata.handoff_id}`);
    // The link is rewritten in the same handler, so the navigation carries the id.
    expect(link.getAttribute("href")).toBe(metadata.destination_url);
  });

  it("fires the view event once, when the bar first shows", async () => {
    setScroll(600);
    renderBar();

    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith("install_bar_view", {
        cta_family: "install_bar",
        surface: "beach_detail",
        pathname: "/ca/san-diego/blacks",
      }),
    );

    fireEvent.scroll(window);
    expect(trackMock.mock.calls.filter(([name]) => name === "install_bar_view")).toHaveLength(1);
  });

  it("dismisses through the parent and tracks it", () => {
    setScroll(600);
    const { onDismiss } = renderBar();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss app install bar" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("install_bar_dismiss", {
      cta_family: "install_bar",
      surface: "beach_detail",
      pathname: "/ca/san-diego/blacks",
    });
  });

  it("hides while an in-flow install ask is on screen, so there is never a second ask", () => {
    setScroll(600);
    document.body.innerHTML =
      '<section aria-label="Get the Quiver app" id="ask"></section>';
    const ask = document.getElementById("ask")!;
    ask.getBoundingClientRect = () =>
      ({ top: 200, bottom: 450, height: 250 }) as DOMRect;

    renderBar();

    expect(screen.getByTestId("install-bar")).toHaveAttribute("data-visible", "false");
  });

  it("sets scroll padding while visible and restores it on unmount", () => {
    setScroll(600);
    document.documentElement.style.scrollPaddingBottom = "4px";
    const { unmount } = renderBar();

    expect(document.documentElement.style.scrollPaddingBottom).toMatch(/^\d+px$/);
    expect(document.documentElement.style.scrollPaddingBottom).not.toBe("4px");

    unmount();
    expect(document.documentElement.style.scrollPaddingBottom).toBe("4px");
  });

  it("uses opacity only under reduced motion and never truncates text", () => {
    reducedMotion = true;
    setScroll(600);
    renderBar();

    const bar = screen.getByTestId("install-bar");
    expect(bar.className).toContain("opacity-100");
    expect(bar.className).not.toMatch(/translate-y/);
    expect(bar.innerHTML).not.toContain("truncate");
  });

  it("falls back to figure-free copy without a value", () => {
    setScroll(600);
    renderBar({ surface: "city_hub", valueLabel: null, placeName: "San Diego" });

    expect(screen.getByTestId("install-bar")).toHaveTextContent("Forecast and alerts for San Diego");
    expect(screen.getByTestId("install-bar")).toHaveTextContent("Free in the app");
  });
});
