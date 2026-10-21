import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import LearnArticlePage from "@/app/learn/[slug]/page";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt = "", fill: _fill, priority: _priority, sizes: _sizes, ...props }: Record<string, unknown>) => (
    <img alt={String(alt)} {...props} />
  ),
}));

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/ui/sticky-signup-bar", () => ({ StickySignupBar: () => null }));
jest.mock("@/components/learn/figures/learn-figure", () => ({ LearnFigure: () => null }));
jest.mock("@/components/learn/figures/embed-figure-snippet", () => ({ EmbedFigureSnippet: () => null }));
jest.mock("@/components/zine", () => ({
  ZineSurface: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  QuiverSticker: () => null,
}));

jest.mock("@/components/seo/inline-signup-cta", () => ({
  InlineSignupCta: ({ source }: { source: string }) => (
    <div data-testid="inline-signup-cta" data-source={source} />
  ),
}));

jest.mock("@/components/app-store/content-page-app-handoff-cta", () => ({
  ContentPageAppHandoffCta: (props: Record<string, string>) => (
    <section
      data-testid={`content-page-app-handoff-cta-${props.surface}`}
      data-source={props.source}
      data-placement={props.placement}
      data-target={props.target}
    >
      {props.title}
      <button type="button">{props.ctaLabel}</button>
    </section>
  ),
}));

const mockTrack = jest.fn();
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

async function renderArticle(slug: string) {
  const ui = await LearnArticlePage({ params: Promise.resolve({ slug }) });
  return render(ui);
}

describe("learn article app handoff", () => {
  it("hands off to the app mid-article with per-article copy", async () => {
    await renderArticle("beginner-breaks-santa-cruz");

    const cta = screen.getByTestId("content-page-app-handoff-cta-learn");
    expect(cta).toHaveAttribute("data-source", "content-learn-beginner-breaks-santa-cruz");
    expect(cta).toHaveAttribute("data-target", "learn:beginner-breaks-santa-cruz");
    expect(cta).toHaveAttribute("data-placement", "mid_article");
    expect(cta).toHaveTextContent("Check these spots before you go.");
    expect(cta).toHaveTextContent("Open Santa Cruz in the app");
    expect(screen.queryByTestId("inline-signup-cta")).toBeNull();
  });

  it("renders exactly one mid-article ask and never the old signup modal", async () => {
    await renderArticle("is-it-safe-to-surf-after-rain");
    expect(screen.getAllByTestId("content-page-app-handoff-cta-learn")).toHaveLength(1);
    expect(screen.queryByTestId("inline-signup-cta")).toBeNull();
  });

  it("points the sidebar at the article's own topic instead of Santa Cruz", async () => {
    const santaCruz = await renderArticle("beginner-breaks-santa-cruz");
    expect(santaCruz.container.querySelector('a[href="/beginner/santa-cruz"]')).not.toBeNull();
    santaCruz.unmount();

    const rain = await renderArticle("is-it-safe-to-surf-after-rain");
    expect(rain.container.querySelector('a[href="/forecast/santa-cruz"]')).toBeNull();
    expect(rain.container.querySelector('a[href="/forecast"]')).not.toBeNull();
  });

  it("puts a tracked live-page link right after The Short Answer, before the app ask", async () => {
    mockTrack.mockClear();
    const { container } = await renderArticle("beginner-breaks-santa-cruz");

    const early = container.querySelector('a[data-placement="learn_short_answer_live_link"]');
    expect(early).toHaveAttribute("href", "/beginner/santa-cruz");

    const answer = container.querySelector("article section[id]");
    const cta = screen.getByTestId("content-page-app-handoff-cta-learn");
    expect(answer!.compareDocumentPosition(early!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(early!.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(early!);
    expect(mockTrack).toHaveBeenCalledWith(
      "cta_click",
      expect.objectContaining({
        metadata: expect.objectContaining({
          cta_family: "learn_live_link",
          placement: "learn_short_answer_live_link",
          source: "content-learn-beginner-breaks-santa-cruz",
          destination_url: "/beginner/santa-cruz",
        }),
      }),
    );
  });

  it("gives every guide an early live link that never lands on a comparison page", async () => {
    const { learnArticles } = await import("@/lib/data/learn-articles");
    for (const { slug } of learnArticles) {
      const view = await renderArticle(slug);
      const early = view.container.querySelector('a[data-placement="learn_short_answer_live_link"]');
      expect(early).not.toBeNull();
      expect(early!.getAttribute("href")).not.toMatch(/^\/(learn|vs\/|forecast-accuracy|blog)/);
      view.unmount();
    }
  });
});
