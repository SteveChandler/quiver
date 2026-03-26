import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { learnArticles } from "@/lib/data/learn-articles";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";

export const metadata: Metadata = buildPageMetadata({
  title: "Learn to Surf Smarter",
  description:
    "Surf forecasting guides, wave science explained, and beginner tips. Learn to read forecasts, understand swell period, and find your best conditions.",
  path: "/learn",
  keywords: [
    "surf forecast guide",
    "learn to surf",
    "swell period explained",
    "how to read surf forecast",
    "beginner surf tips",
  ],
});

const CROSS_LINKS = [
  {
    href: "/guides",
    label: "Regional Surf Guides",
    desc: "Explore 10+ coastal regions",
  },
  {
    href: "/forecast-accuracy",
    label: "Forecast Accuracy",
    desc: "See how our ML corrections perform",
  },
  {
    href: "/best-time-to-surf",
    label: "Best Time to Surf",
    desc: "Monthly surf quality by city",
  },
];

export default function LearnHubPage() {
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Learn", url: "/learn" },
  ];

  const featuredArticle = learnArticles[0];
  const remainingArticles = learnArticles.slice(1, 5);

  return (
    <>
      <BreadcrumbStructuredData items={breadcrumbs} />
      <WebPageSchema
        name="Learn to Surf Smarter"
        description="Surf forecasting guides, wave science, and beginner tips from Quiver."
        url="/learn"
      />

      {/* ------------------------------------------------------------------ */}
      {/* 1. Full-bleed hero                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative min-h-[24rem] sm:min-h-[28rem] flex items-end overflow-hidden">
        {/* Background image */}
        <Image
          src="/4groms.jpg"
          alt="Four young surfers walking toward the ocean on a wide beach at dawn"
          width={1200}
          height={800}
          className="absolute inset-0 h-full w-full object-cover"
          priority
        />

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#252D6B] via-[#252D6B]/70 to-[#252D6B]/20" />

        {/* Noise texture overlay */}
        <div className="noise-texture-subtle absolute inset-0 pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 pt-16">
          <ScrollReveal>
            <p
              className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-[#F78E42]"
              style={{ transform: "rotate(-1deg)" }}
            >
              Quiver Guides
            </p>
            <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-white sm:text-5xl lg:text-6xl">
              Learn to Surf Smarter
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg">
              Understanding the ocean makes every session better. These guides
              break down surf forecasting, wave science, and conditions — so you
              know exactly what to look for before you paddle out.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <main>
        {/* ---------------------------------------------------------------- */}
        {/* 2. Featured article — full-width split card                      */}
        {/* ---------------------------------------------------------------- */}
        <ScrollReveal>
          <div className="-mt-16 relative z-20 mx-auto max-w-6xl px-4">
            <Link
              href={`/learn/${featuredArticle.slug}`}
              className="group grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-200 hover:border-[#F78E42]/30 hover:shadow-lg hover:shadow-black/20"
            >
              {/* Left: text content */}
              <div className="flex flex-col justify-center p-6 sm:p-8">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#F78E42]">
                  Featured
                </p>
                <h2 className="font-display text-2xl font-bold text-white transition-colors duration-200 group-hover:text-[#F78E42]">
                  {featuredArticle.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-400">
                  {featuredArticle.description}
                </p>
                <div className="mt-5 flex items-center gap-4 text-xs">
                  <span className="text-gray-500">
                    {featuredArticle.readingTimeMin} min read
                  </span>
                  <span className="font-medium text-[#F78E42] transition-opacity duration-200 opacity-70 group-hover:opacity-100">
                    Read guide &rarr;
                  </span>
                </div>
              </div>

              {/* Right: thumbnail image */}
              <div className="relative min-h-[16rem] md:min-h-[20rem]">
                <Image
                  src={featuredArticle.thumbnailImage}
                  alt={featuredArticle.title}
                  width={1200}
                  height={800}
                  className="absolute inset-0 h-full w-full object-cover md:rounded-r-xl"
                />
              </div>
            </Link>
          </div>
        </ScrollReveal>

        {/* ---------------------------------------------------------------- */}
        {/* 3. Remaining articles grid (2x2)                                 */}
        {/* ---------------------------------------------------------------- */}
        <div className="mx-auto max-w-6xl px-4 mt-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {remainingArticles.map((article, i) => (
              <ScrollReveal key={article.slug} delay={i * 80}>
                <Link
                  href={`/learn/${article.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-200 hover:border-[#F78E42]/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
                >
                  {/* Card thumbnail */}
                  <div className="relative h-40 overflow-hidden">
                    <Image
                      src={article.thumbnailImage}
                      alt={article.title}
                      width={600}
                      height={400}
                      className="h-full w-full object-cover rounded-t-xl transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  </div>

                  {/* Card text content */}
                  <div className="p-5 flex flex-col flex-1">
                    <h2 className="font-display text-lg font-semibold text-white transition-colors duration-200 group-hover:text-[#F78E42]">
                      {article.title}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-400">
                      {article.description}
                    </p>
                    <span className="mt-3 text-xs text-gray-500">
                      {article.readingTimeMin} min read
                    </span>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* 4. Cross-links section                                           */}
        {/* ---------------------------------------------------------------- */}
        <ScrollReveal>
          <section className="mx-auto max-w-6xl px-4 mt-16 mb-16">
            <h2 className="mb-1 font-display text-lg font-semibold text-white">
              More from Quiver
            </h2>
            <p className="mb-5 text-sm text-gray-500">
              Dive deeper into forecasts, spots, and conditions.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {CROSS_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-200 hover:border-[#F78E42]/30 hover:bg-[#F78E42]/[0.04]"
                >
                  <span className="block font-display text-sm font-semibold text-gray-200 transition-colors duration-200 group-hover:text-white">
                    {link.label}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                    {link.desc}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </ScrollReveal>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Sticky signup bar                                               */}
      {/* ------------------------------------------------------------------ */}
      <StickySignupBar source="learn_hub" />
    </>
  );
}
