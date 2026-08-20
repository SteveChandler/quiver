import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArticleSchema } from "@/components/seo/article-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { LearnFigure } from "@/components/learn/figures/learn-figure";
import { EmbedFigureSnippet } from "@/components/learn/figures/embed-figure-snippet";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import { learnArticles } from "@/lib/data/learn-articles";
import { buildPageMetadata } from "@/lib/seo/meta";

export const revalidate = 604800; // 1 week - learn articles are static content from a constant

interface Props {
  params: Promise<{ slug: string }>;
}

const LEGACY_LEARN_SLUGS: Record<string, string> = {
  "how-to-read-a-surf-report": "how-to-read-surf-conditions",
  "how-to-read-a-surf-forecast": "how-to-read-surf-conditions",
  "wind-swell-vs-ground-swell": "groundswell-vs-wind-swell",
  "wind-swell-vs-groundswell": "groundswell-vs-wind-swell",
  "groundswell-vs-windswell": "groundswell-vs-wind-swell",
};

function resolveArticleSlug(slug: string): string {
  return LEGACY_LEARN_SLUGS[slug] ?? slug;
}

function getArticle(slug: string) {
  const resolvedSlug = resolveArticleSlug(slug);
  return learnArticles.find((article) => article.slug === resolvedSlug) ?? null;
}

function getNextArticle(slug: string) {
  const resolvedSlug = resolveArticleSlug(slug);
  const index = learnArticles.findIndex((article) => article.slug === resolvedSlug);
  if (index === -1) return null;
  return learnArticles[(index + 1) % learnArticles.length];
}

export function generateStaticParams(): { slug: string }[] {
  return learnArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSlug = resolveArticleSlug(slug);
  const article = getArticle(resolvedSlug);
  if (!article) return {};

  const ogImage =
    article.slug === "groundswell-vs-wind-swell"
      ? `/api/og/learn?slug=${article.slug}`
      : `/api/og/guide?title=${encodeURIComponent(article.title)}&region=Learn`;

  return buildPageMetadata({
    title: article.title,
    description: article.description,
    path: `/learn/${article.slug}`,
    keywords: article.keywords,
    image: ogImage,
  });
}

export default async function LearnArticlePage({ params }: Props) {
  const { slug } = await params;
  const resolvedSlug = resolveArticleSlug(slug);
  if (resolvedSlug !== slug) {
    redirect(`/learn/${resolvedSlug}`);
  }

  const article = getArticle(slug);
  if (!article) notFound();

  const nextArticle = getNextArticle(slug);

  const breadcrumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Learn", url: `${SITE_URL}/learn` },
    { name: article.title, url: `${SITE_URL}/learn/${article.slug}` },
  ];

  const toc = article.sections.map((section) => ({
    id: section.id,
    label: section.heading,
  }));

  const keyTakeaways = article.sections.filter((section) => section.keyTakeaway);

  return (
    <>
      <BreadcrumbStructuredData items={breadcrumbs} />
      <FAQSchema items={article.faqs} />
      <WebPageSchema
        name={article.title}
        description={article.description}
        url={`${SITE_URL}/learn/${article.slug}`}
      />
      <ArticleSchema
        title={article.title}
        description={article.description}
        url={`${SITE_URL}/learn/${article.slug}`}
        imageUrl={article.heroImage}
        datePublished={article.datePublished || "2026-03-26"}
        dateModified={article.dateModified}
      />

      <ZineSurface
        sectionLabel="Learn"
        editionLabel={`${article.readingTimeMin} min field note`}
        data-testid="learn-article-zine-surface"
      >
        <main>
          <nav className="mb-8 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/58">
            <Link href="/" className="transition-colors hover:text-[#B56A2B]">
              Home
            </Link>
            <span aria-hidden>/</span>
            <Link href="/learn" className="transition-colors hover:text-[#B56A2B]">
              Learn
            </Link>
            <span aria-hidden>/</span>
            <span className="text-[#11100D]">{article.title}</span>
          </nav>

          <header className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
            <ScrollReveal>
              <div className="relative">
                <QuiverSticker
                  sticker="orangeTape"
                  className="absolute -top-8 left-8 hidden w-36 -rotate-6 opacity-85 sm:block"
                />
                <Link
                  href="/learn"
                  className="label-black mb-5 transition-transform hover:-translate-y-0.5"
                >
                  Quiver Guides
                </Link>
                <h1 className="zine-h1 font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
                  {article.title}
                </h1>
                <p className="mt-6 max-w-3xl text-xl leading-relaxed text-[#11100D]/75">
                  {article.description}
                </p>
                <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/58">
                  {article.readingTimeMin} min read
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={80} className="lg:h-full">
              <div className="polaroid polaroid-fill rot-2">
                <div className="photo">
                  <Image
                    src={article.heroImage}
                    alt={article.title}
                    fill
                    className="object-cover saturate-[0.75]"
                    sizes="(min-width: 1024px) 440px, 100vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-[#F4EBD8]/10 mix-blend-screen" />
                  <QuiverSticker
                    sticker="singleFin"
                    className="absolute -bottom-8 -right-6 w-28 rotate-6 drop-shadow-md"
                  />
                </div>
                <p className="cap">field note</p>
              </div>
            </ScrollReveal>
          </header>

          <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <article className="min-w-0">
              {keyTakeaways.length > 0 && (
                <ScrollReveal>
                  <div className="torn torn-tb rot-neg mb-12 border-2 border-[#11100D] bg-[#F0E5CC] pt-8 pb-8">
                    <div className="mb-4 flex items-center gap-3">
                      <QuiverSticker
                        sticker="surfWax"
                        className="w-14 -rotate-6 drop-shadow-sm"
                      />
                      <h2 className="font-display text-2xl font-black uppercase text-[#11100D]">
                        Key Takeaways
                      </h2>
                    </div>
                    <ul className="space-y-3 pb-3">
                      {keyTakeaways.map((section) => (
                        <li
                          key={section.id}
                          className="flex gap-3 text-sm leading-relaxed text-[#11100D]/78"
                        >
                          <span className="mt-1.5 block h-2 w-2 shrink-0 rounded-full bg-[#F78E42]" />
                          {section.keyTakeaway}
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollReveal>
              )}

              {article.sections.map((section, index) => (
                <ScrollReveal key={section.id}>
                  <section className="mb-14 scroll-mt-24" id={section.id}>
                    <div className="mb-5 flex items-baseline gap-3 border-b-2 border-dashed border-[#11100D]/30 pb-3">
                      <span className="circled shrink-0">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h2 className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
                        {section.heading}
                      </h2>
                    </div>

                    {section.figureKey ? (
                      <div className="mb-6">
                        <LearnFigure figureKey={section.figureKey} />
                        <EmbedFigureSnippet figureKey={section.figureKey} />
                      </div>
                    ) : null}

                    {section.image ? (
                      <div
                        className={`flex flex-col gap-7 md:items-start ${
                          section.image.position === "left"
                            ? "md:flex-row-reverse"
                            : "md:flex-row"
                        }`}
                      >
                        <div
                          className="prose max-w-none flex-1 text-[#11100D]/78 [&_p]:mb-4 [&_p]:leading-relaxed [&_strong]:text-[#11100D]"
                          dangerouslySetInnerHTML={{ __html: section.content }}
                        />
                        <div className="w-full shrink-0 md:w-[38%]">
                          <div className="polaroid">
                            <div className="photo">
                              <Image
                                src={section.image.src}
                                alt={section.image.alt}
                                fill
                                className="object-cover saturate-[0.78]"
                                sizes="(min-width: 768px) 320px, 100vw"
                              />
                            </div>
                            <p className="cap">{section.heading}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="prose max-w-none text-[#11100D]/78 [&_p]:mb-4 [&_p]:leading-relaxed [&_strong]:text-[#11100D]"
                        dangerouslySetInnerHTML={{ __html: section.content }}
                      />
                    )}
                  </section>

                  {index % 2 === 1 && section.keyTakeaway && (
                    <blockquote className="notebook rot-1 my-10">
                      <p className="font-handwritten text-2xl leading-tight text-[#11100D]">
                        {section.keyTakeaway}
                      </p>
                    </blockquote>
                  )}

                  {index === 2 && (
                    <InlineSignupCta
                      title="Stop guessing. Start scoring."
                      description="Pick your home beach. We score every hour by tide, wind, and swell and tell you when to paddle out."
                      primaryButtonText="Pick your home beach"
                      source="learn_article"
                      ctaCopyVariant="learn_article_v1"
                      className="my-10"
                      variant="zine"
                    />
                  )}
                </ScrollReveal>
              ))}
            </article>

            <aside className="space-y-6 lg:sticky lg:top-6">
              {toc.length > 3 && (
                <ScrollReveal>
                  <nav className="notebook" aria-label="In this guide">
                    <p className="typewriter mb-3">In this guide</p>
                    <ol className="space-y-2">
                      {toc.map((item, index) => (
                        <li key={item.id}>
                          <a
                            href={`#${item.id}`}
                            className="group flex items-baseline gap-2 text-sm leading-tight text-[#11100D]/72 transition-colors hover:text-[#B56A2B]"
                          >
                            <span className="font-mono text-xs text-[#11100D]/42 transition-colors group-hover:text-[#B56A2B]">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            {item.label}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                </ScrollReveal>
              )}

              <ScrollReveal>
                <div className="torn torn-tb border-2 border-[#11100D] bg-[#FBF6E8]">
                  <QuiverSticker
                    sticker="goldDownArrow"
                    className="float-right ml-2 w-10 rotate-6"
                  />
                  <p className="typewriter mb-2">Next paddle</p>
                  <p className="text-sm leading-relaxed text-[#11100D]/72">
                    Use this note, then check a live regional forecast before
                    committing to the drive.
                  </p>
                  <Link
                    href="/forecast/santa-cruz"
                    className="mt-4 inline-flex font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#B56A2B] hover:text-[#11100D]"
                  >
                    Santa Cruz forecast &rarr;
                  </Link>
                </div>
              </ScrollReveal>
            </aside>
          </div>

          {article.faqs.length > 0 && (
            <ScrollReveal>
              <section className="mt-8 border-t-2 border-dashed border-[#11100D]/35 pt-10">
                <h2 className="mb-6 font-display text-2xl font-black uppercase text-[#11100D]">
                  Frequently Asked Questions
                </h2>
                <div className="space-y-4">
                  {article.faqs.map((faq) => (
                    <details
                      key={faq.question}
                      className="group torn border-2 border-[#11100D] bg-[#FBF6E8] open:bg-[#F0E5CC]"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-black uppercase text-[#11100D] transition-colors hover:text-[#B56A2B] [&::-webkit-details-marker]:hidden">
                        {faq.question}
                        <span className="shrink-0 font-mono text-2xl leading-none transition-transform duration-200 group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <p className="mt-4 text-sm leading-relaxed text-[#11100D]/72">
                        {faq.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            </ScrollReveal>
          )}

          {nextArticle && (
            <ScrollReveal>
              <section className="mt-14 border-t-2 border-dashed border-[#11100D]/35 pt-10">
                <p className="label-black mb-5">Up Next</p>
                <Link
                  href={`/learn/${nextArticle.slug}`}
                  className="group torn torn-tb grid gap-5 border-2 border-[#11100D] bg-[#F0E5CC] transition-transform hover:-translate-y-1 sm:grid-cols-[8rem_1fr]"
                >
                  <div className="relative h-32 overflow-hidden border-2 border-[#11100D] bg-[#C8C2B0]">
                    <Image
                      src={nextArticle.thumbnailImage}
                      alt={nextArticle.title}
                      fill
                      className="object-cover saturate-[0.78] transition-transform duration-300 group-hover:scale-105"
                      sizes="128px"
                    />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-black uppercase leading-tight text-[#11100D] transition-colors group-hover:text-[#B56A2B]">
                      {nextArticle.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#11100D]/68">
                      {nextArticle.description}
                    </p>
                    <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/55">
                      {nextArticle.readingTimeMin} min read
                    </p>
                  </div>
                </Link>
              </section>
            </ScrollReveal>
          )}

          {article.relatedLinks.length > 0 && (
            <ScrollReveal>
              <section className="mt-12">
                <h2 className="mb-4 font-display text-xl font-black uppercase text-[#11100D]">
                  Keep Exploring
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {article.relatedLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group torn border-2 border-[#11100D] bg-[#FBF6E8] p-4 transition-transform hover:-translate-y-0.5"
                    >
                      <span className="text-sm font-bold text-[#11100D] transition-colors group-hover:text-[#B56A2B]">
                        {link.label}
                      </span>
                      <p className="mt-1 text-xs leading-relaxed text-[#11100D]/62">
                        {link.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            </ScrollReveal>
          )}

          <div className="mt-12 text-center">
            <Link
              href="/learn"
              className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D]/58 transition-colors hover:text-[#B56A2B]"
            >
              &larr; All guides
            </Link>
          </div>
        </main>
      </ZineSurface>

      <StickySignupBar source="learn_article" />
    </>
  );
}
