import type { LearnArticle, LearnArticleAppHandoff } from "@/lib/data/learn-articles";

export interface LearnNextPaddleLink {
  href: string;
  label: string;
}

export interface ResolvedLearnAppHandoff extends LearnArticleAppHandoff {
  source: string;
  target: string;
}

const DEFAULT_NEXT_PADDLE: LearnNextPaddleLink = {
  href: "/forecast",
  label: "Live regional forecasts",
};

const DEFAULT_APP_HANDOFF: LearnArticleAppHandoff = {
  eyebrow: "Put this to work",
  title: "Now check it against your beach.",
  description:
    "Open your home break in the Quiver app to see today's swell, wind, and tide scored hour by hour.",
  ctaLabel: "Check my beach in the app",
};

/**
 * The sidebar used to send every article to the Santa Cruz forecast, whatever
 * the topic. Prefer the article's own first non-learn link so a San Diego
 * beginner guide points at San Diego.
 */
export function resolveLearnNextPaddleLink(
  article: Pick<LearnArticle, "relatedLinks">,
): LearnNextPaddleLink {
  const link = article.relatedLinks.find(({ href }) => !href.startsWith("/learn"));
  if (!link) return DEFAULT_NEXT_PADDLE;
  return { href: link.href, label: link.label };
}

export function resolveLearnAppHandoff(
  article: Pick<LearnArticle, "slug" | "appHandoff">,
): ResolvedLearnAppHandoff {
  return {
    ...DEFAULT_APP_HANDOFF,
    ...article.appHandoff,
    source: `content-learn-${article.slug}`,
    target: `learn:${article.slug}`,
  };
}
