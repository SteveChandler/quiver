import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import LearnArticlePage from "@/app/learn/[slug]/page";
import { LEARN_APP_HANDOFF_CTA_ENABLED } from "@/lib/flags/learn-app-handoff-cta";

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

const originalFlag = process.env[LEARN_APP_HANDOFF_CTA_ENABLED];

function setFlag(value: string | undefined): void {
  if (value === undefined) delete process.env[LEARN_APP_HANDOFF_CTA_ENABLED];
  else process.env[LEARN_APP_HANDOFF_CTA_ENABLED] = value;
}

async function renderArticle(slug: string) {
  const ui = await LearnArticlePage({ params: Promise.resolve({ slug }) });
  return render(ui);
}

describe("learn article app handoff", () => {
  afterEach(() => setFlag(originalFlag));

  it("hands off to the app mid-article when the flag is on, with per-article copy", async () => {
    setFlag("true");
    await renderArticle("beginner-breaks-santa-cruz");

    const cta = screen.getByTestId("content-page-app-handoff-cta-learn");
    expect(cta).toHaveAttribute("data-source", "content-learn-beginner-breaks-santa-cruz");
    expect(cta).toHaveAttribute("data-target", "learn:beginner-breaks-santa-cruz");
    expect(cta).toHaveAttribute("data-placement", "mid_article");
    expect(cta).toHaveTextContent("Check these spots before you go.");
    expect(cta).toHaveTextContent("Open Santa Cruz in the app");
    expect(screen.queryByTestId("inline-signup-cta")).toBeNull();
  });

  it("keeps the web signup modal when the flag is off", async () => {
    setFlag(undefined);
    await renderArticle("beginner-breaks-santa-cruz");

    expect(screen.getByTestId("inline-signup-cta")).toHaveAttribute("data-source", "learn_article");
    expect(screen.queryByTestId("content-page-app-handoff-cta-learn")).toBeNull();
  });

  it("renders exactly one mid-article ask either way", async () => {
    for (const flag of ["true", undefined]) {
      setFlag(flag);
      const { unmount } = await renderArticle("is-it-safe-to-surf-after-rain");
      const asks = [
        ...screen.queryAllByTestId("inline-signup-cta"),
        ...screen.queryAllByTestId("content-page-app-handoff-cta-learn"),
      ];
      expect(asks).toHaveLength(1);
      unmount();
    }
  });

  it("points the sidebar at the article's own topic instead of Santa Cruz", async () => {
    setFlag(undefined);
    const santaCruz = await renderArticle("beginner-breaks-santa-cruz");
    expect(santaCruz.container.querySelector('a[href="/beginner/santa-cruz"]')).not.toBeNull();
    santaCruz.unmount();

    const rain = await renderArticle("is-it-safe-to-surf-after-rain");
    expect(rain.container.querySelector('a[href="/forecast/santa-cruz"]')).toBeNull();
    expect(rain.container.querySelector('a[href="/forecast"]')).not.toBeNull();
  });
});
