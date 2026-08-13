import { fireEvent, render, screen } from "@testing-library/react";

import { ContentPageAppHandoffCta } from "@/components/app-store/content-page-app-handoff-cta";
import { trackAppHandoffView } from "@/lib/analytics/app-handoff-tracking";
import { ANONYMOUS_ALLOWED_EVENTS } from "@/lib/analytics/event-taxonomy";

const mockTrack = jest.fn();

jest.mock("@/context/auth-context", () => ({
  useOptionalAuth: () => ({ user: null, isLoading: false }),
}));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("@/lib/analytics/app-handoff-tracking", () => ({
  trackAppHandoffView: jest.fn(),
}));

const mockTrackAppHandoffView = trackAppHandoffView as jest.MockedFunction<
  typeof trackAppHandoffView
>;

const EMITTED_EVENTS = [
  "cta_impression",
  "cta_click",
  "app_handoff_view",
] as const;

const CASES = [
  {
    surface: "beach_detail" as const,
    placement: "above_fold_after_public_answer",
    source: "content-beach-detail-blacks",
    target: "beach:blacks",
    eyebrow: "Next call · Blacks",
    title: "Watch the next good window at Blacks.",
    description: "Today's call is here.",
    ctaLabel: "Watch the next window in the app",
  },
  {
    surface: "water_temp" as const,
    placement: "above_fold_after_temperature",
    source: "content-water-temp-san-diego",
    target: "water-temp:san-diego",
    eyebrow: "San Diego water temp · next check",
    title: "Water temp sorted. Is it worth paddling out?",
    description: "Your water answer is set.",
    ctaLabel: "Check the surf in the app",
  },
  {
    surface: "city_hub" as const,
    placement: "best_right_now",
    source: "content-city-hub-san-diego-ca",
    target: "beach:ocean-beach",
    eyebrow: "Best right now · Ocean Beach",
    title: "Keep Ocean Beach in reach.",
    description: "Open the spot forecast in the app.",
    ctaLabel: "Open Ocean Beach in the app",
  },
] as const;

describe("ContentPageAppHandoffCta", () => {
  const originalIntersectionObserver = globalThis.IntersectionObserver;

  beforeEach(() => {
    jest.clearAllMocks();
    const immediateIntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
      const observer = {
        observe: () => {
          callback(
            [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
            observer as unknown as IntersectionObserver,
          );
        },
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
      return observer as unknown as IntersectionObserver;
    });
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: immediateIntersectionObserver,
    });
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: immediateIntersectionObserver,
    });
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
  });

  it.each(EMITTED_EVENTS)(
    "%s is allowed for anonymous visitors",
    (eventType) => {
      expect(ANONYMOUS_ALLOWED_EVENTS).toContain(eventType);
    },
  );

  it.each(CASES)(
    "renders and instruments the $surface CTA at $placement",
    (props) => {
      render(<ContentPageAppHandoffCta {...props} />);

      const cta = screen.getByTestId(
        `content-page-app-handoff-cta-${props.surface}`,
      );
      const link = screen.getByRole("link", { name: props.ctaLabel });

      expect(cta).toHaveAttribute("data-surface", props.surface);
      expect(cta).toHaveAttribute("data-placement", props.placement);
      expect(link).toHaveAttribute("href", expect.stringContaining("/app/handoff"));
      expect(link).toHaveAttribute("href", expect.stringContaining(`surface=${props.surface}`));
      expect(link).toHaveAttribute("href", expect.stringContaining(`placement=${props.placement}`));

      expect(mockTrackAppHandoffView).toHaveBeenCalledWith(
        expect.objectContaining({
          source: props.source,
          surface: props.surface,
          placement: props.placement,
          target: props.target,
          stage: "content_cta",
        }),
      );
      expect(mockTrack).toHaveBeenCalledWith(
        "cta_impression",
        expect.objectContaining({
          metadata: expect.objectContaining({
            surface: props.surface,
            placement: props.placement,
          }),
        }),
      );

      expect(mockTrackAppHandoffView).toHaveBeenCalledTimes(1);
      expect(
        mockTrack.mock.calls.filter(([eventType]) => eventType === "cta_impression"),
      ).toHaveLength(1);

      const intersectionCallback = (globalThis.IntersectionObserver as jest.Mock).mock
        .calls[0]?.[0] as IntersectionObserverCallback;
      intersectionCallback(
        [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );

      expect(mockTrackAppHandoffView).toHaveBeenCalledTimes(1);
      expect(
        mockTrack.mock.calls.filter(([eventType]) => eventType === "cta_impression"),
      ).toHaveLength(1);

      fireEvent.click(link);

      expect(mockTrack).toHaveBeenCalledWith(
        "cta_click",
        expect.objectContaining({
          debounceMs: 0,
          metadata: expect.objectContaining({
            source: props.source,
            surface: props.surface,
            placement: props.placement,
            cta_text: props.ctaLabel,
            target: props.target,
            destination_type: "app_handoff",
            cta_family: "app_handoff",
          }),
        }),
      );
    },
  );
});
