import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { learnArticles } from "@/lib/data/learn-articles";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ArticleSchema } from "@/components/seo/article-schema";
import { SITE_URL } from "@/lib/constants/seo";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";

export const revalidate = 604800; // 1 week — learn articles are static content from a constant

interface Props {
  params: Promise<{ slug: string }>;
}

function getArticle(slug: string) {
  return learnArticles.find((a) => a.slug === slug) ?? null;
}

function getNextArticle(slug: string) {
  const index = learnArticles.findIndex((a) => a.slug === slug);
  if (index === -1) return null;
  return learnArticles[(index + 1) % learnArticles.length];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  return buildPageMetadata({
    title: article.title,
    description: article.description,
    path: `/learn/${article.slug}`,
    keywords: article.keywords,
    image: `/api/og/guide?title=${encodeURIComponent(article.title)}&region=Learn`,
  });
}

export default async function LearnArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const nextArticle = getNextArticle(slug);

  const breadcrumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Learn", url: `${SITE_URL}/learn` },
    { name: article.title, url: `${SITE_URL}/learn/${article.slug}` },
  ];

  const toc = article.sections.map((s) => ({
    id: s.id,
    label: s.heading,
  }));

  const keyTakeaways = article.sections.filter((s) => s.keyTakeaway);

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

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header className="relative min-h-[16rem] sm:min-h-[20rem] flex flex-col justify-end overflow-hidden">
        {/* Background image */}
        <Image
          src={article.heroImage}
          alt={article.title}
          width={1600}
          height={900}
          priority
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#252D6B] via-[#252D6B]/80 to-[#252D6B]/30" />

        {/* Noise texture */}
        <div className="noise-texture-subtle absolute inset-0 pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-8 pt-16 sm:px-6 lg:px-8">
          {/* Breadcrumb nav */}
          <nav className="mb-6 text-sm text-gray-300/70">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span className="mx-2 select-none">/</span>
            <Link href="/learn" className="hover:text-white transition-colors">
              Learn
            </Link>
            <span className="mx-2 select-none">/</span>
            <span className="text-gray-200">{article.title}</span>
          </nav>

          <Link
            href="/learn"
            className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-[#F78E42] transition-colors hover:text-[#FDB84B]"
          >
            Quiver Guides
          </Link>

          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {article.title}
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-200/90">
            {article.description}
          </p>

          <p className="mt-3 text-sm text-gray-300/60 font-mono">
            {article.readingTimeMin} min read
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ---------------------------------------------------------------- */}
        {/* Table of Contents                                                */}
        {/* ---------------------------------------------------------------- */}
        {toc.length > 3 && (
          <ScrollReveal>
            <nav className="mb-10 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                In this guide
              </p>
              <ol className="space-y-1">
                {toc.map((item, i) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="group flex items-baseline gap-2 text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      <span className="font-mono text-xs text-gray-600 group-hover:text-[#F78E42] transition-colors">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </ScrollReveal>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Key Takeaways                                                    */}
        {/* ---------------------------------------------------------------- */}
        {keyTakeaways.length > 0 && (
          <ScrollReveal>
            <div
              className="mb-12 rounded-xl border border-[#F78E42]/20 bg-[#F78E42]/[0.04] p-6"
              style={{ transform: "rotate(-0.5deg)" }}
            >
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#F78E42]">
                Key Takeaways
              </h2>
              <ul className="space-y-2.5">
                {keyTakeaways.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-2.5 text-sm leading-relaxed text-gray-200"
                  >
                    <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#F78E42]" />
                    {s.keyTakeaway}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Article Body                                                     */}
        {/* ---------------------------------------------------------------- */}
        {article.sections.map((section, i) => (
          <ScrollReveal key={section.id}>
            <section className="mb-14" id={section.id}>
              {/* Section number + heading */}
              <div className="mb-4 flex items-baseline gap-3">
                <span className="font-mono text-xs text-[#F78E42]/50 select-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">
                  {section.heading}
                </h2>
              </div>

              {/* Section body — split layout when image present, full-width otherwise */}
              {section.image ? (
                <div
                  className={`flex flex-col gap-6 md:flex-row md:items-start md:gap-8 ${
                    section.image.position === "left" ? "md:flex-row-reverse" : ""
                  }`}
                >
                  {/* Text side */}
                  <div
                    className="prose prose-invert prose-gray max-w-none flex-1 text-gray-300 [&_p]:mb-4 [&_p]:leading-relaxed [&_strong]:text-white"
                    dangerouslySetInnerHTML={{ __html: section.content }}
                  />
                  {/* Image side — constrained height so it stays proportional to text */}
                  <div className="w-full shrink-0 md:w-1/3">
                    <div className="relative h-48 overflow-hidden rounded-xl border border-white/10 sm:h-52">
                      <Image
                        src={section.image.src}
                        alt={section.image.alt}
                        width={400}
                        height={260}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="prose prose-invert prose-gray max-w-none text-gray-300 [&_p]:mb-4 [&_p]:leading-relaxed [&_strong]:text-white"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              )}
            </section>

            {/* Pull quote after every odd section (index 1, 3, 5...) with a keyTakeaway */}
            {i % 2 === 1 && section.keyTakeaway && (
              <blockquote className="my-10 border-l-2 border-[#F78E42] pl-6 py-2">
                <p
                  className="text-xl leading-relaxed text-gray-200 italic font-handwritten"
                >
                  &ldquo;{section.keyTakeaway}&rdquo;
                </p>
              </blockquote>
            )}

            {/* CTA after 3rd section -- natural reading break */}
            {i === 2 && (
              <InlineSignupCta
                title="Track Your Sessions"
                description="Log your surf sessions and get personalized forecasts based on the conditions you love."
                source="learn_article"
                className="my-10"
              />
            )}
          </ScrollReveal>
        ))}

        {/* ---------------------------------------------------------------- */}
        {/* FAQ Section                                                      */}
        {/* ---------------------------------------------------------------- */}
        {article.faqs.length > 0 && (
          <ScrollReveal>
            <section className="mb-12 mt-16 border-t border-white/10 pt-10">
              <h2 className="mb-6 font-display text-xl font-semibold text-white sm:text-2xl">
                Frequently Asked Questions
              </h2>
              <div className="space-y-4">
                {article.faqs.map((faq, i) => (
                  <details
                    key={i}
                    className="group rounded-lg border border-white/10 bg-white/[0.03] transition-colors open:border-[#F78E42]/20 open:bg-[#F78E42]/[0.02]"
                  >
                    <summary className="cursor-pointer select-none p-5 font-medium text-white transition-colors hover:text-[#F78E42] [&::-webkit-details-marker]:hidden list-none">
                      <span className="flex items-center justify-between">
                        {faq.question}
                        <span className="ml-4 shrink-0 text-gray-500 transition-transform duration-200 group-open:rotate-45">
                          +
                        </span>
                      </span>
                    </summary>
                    <div className="px-5 pb-5">
                      <p className="text-sm leading-relaxed text-gray-300">
                        {faq.answer}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </ScrollReveal>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Up Next Navigation                                               */}
        {/* ---------------------------------------------------------------- */}
        {nextArticle && (
          <ScrollReveal>
            <section className="mb-12 mt-16 border-t border-white/10 pt-10">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#F78E42]">
                Up next
              </p>
              <Link
                href={`/learn/${nextArticle.slug}`}
                className="group flex items-start gap-5 rounded-lg border border-white/10 bg-white/[0.03] p-5 transition-all duration-200 hover:border-[#F78E42]/30 hover:bg-[#F78E42]/[0.04] hover:-translate-y-0.5"
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={nextArticle.thumbnailImage}
                    alt={nextArticle.title}
                    width={200}
                    height={200}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-semibold text-white transition-colors group-hover:text-[#F78E42] sm:text-lg">
                    {nextArticle.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-400">
                    {nextArticle.description}
                  </p>
                  <p className="mt-2 text-xs text-gray-500 font-mono">
                    {nextArticle.readingTimeMin} min read
                  </p>
                </div>
              </Link>
            </section>
          </ScrollReveal>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Related Content                                                  */}
        {/* ---------------------------------------------------------------- */}
        {article.relatedLinks.length > 0 && (
          <ScrollReveal>
            <section className="mb-12">
              <h2 className="mb-4 font-display text-lg font-semibold text-white">
                Keep Exploring
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {article.relatedLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group rounded-lg border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 hover:border-[#F78E42]/30 hover:bg-[#F78E42]/[0.04] hover:-translate-y-0.5"
                  >
                    <span className="text-sm font-medium text-white transition-colors duration-200 group-hover:text-[#F78E42]">
                      {link.label}
                    </span>
                    <p className="mt-1 text-xs text-gray-400">
                      {link.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          </ScrollReveal>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Back to Hub                                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="mb-8 text-center">
          <Link
            href="/learn"
            className="text-sm text-gray-500 transition-colors hover:text-[#F78E42]"
          >
            &larr; All guides
          </Link>
        </div>
      </main>

      <StickySignupBar source="learn_article" />
    </>
  );
}
