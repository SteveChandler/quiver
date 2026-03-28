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
      <section className="relative min-h-[28rem] sm:min-h-[34rem] flex items-end overflow-hidden">
        {/* Background image */}
        <Image
          src="/4groms.jpg"
          alt="Four young surfers walking toward the ocean on a wide beach at dawn"
          width={1200}
          height={800}
          className="absolute inset-0 h-full w-full object-cover"
          priority
        />

        {/* Dark gradient overlay — heavier for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#252D6B] via-[#252D6B]/80 to-[#252D6B]/10" />

        {/* Noise texture overlay */}
        <div className="noise-texture-subtle absolute inset-0 pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-24 pt-20">
          <ScrollReveal>
            <p
              className="mb-4 inline-block rounded-full bg-[#F78E42]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#F78E42]"
              style={{ transform: "rotate(-2deg)" }}
            >
              Quiver Guides
            </p>
            <h1 className="font-display text-5xl font-extrabold uppercase tracking-tight text-white sm:text-6xl lg:text-7xl text-glow-orange">
              Learn to Surf
              <br />
              Smarter
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-gray-300 sm:text-lg">
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
              className="group grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-[#252D6B]/60 backdrop-blur-sm transition-all duration-300 hover:border-[#F78E42]/40 hover:shadow-2xl hover:shadow-[#F78E42]/10"
            >
              {/* Orange left accent bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F78E42] rounded-l-xl" />

              {/* Left: text content */}
              <div className="flex flex-col justify-center p-8 sm:p-10">
                <p
                  className="mb-3 inline-block w-fit rounded-full bg-[#F78E42]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#F78E42]"
                  style={{ transform: "rotate(-1.5deg)" }}
                >
                  Featured
                </p>
                <h2 className="font-display text-3xl font-extrabold text-white transition-colors duration-200 group-hover:text-[#F78E42] sm:text-4xl">
                  {featuredArticle.title}
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-gray-400 sm:text-base">
                  {featuredArticle.description}
                </p>
                <div className="mt-6 flex items-center gap-4 text-xs">
                  <span className="text-gray-500">
                    {featuredArticle.readingTimeMin} min read
                  </span>
                  <span className="font-bold text-[#F78E42] transition-all duration-200 opacity-70 group-hover:opacity-100 group-hover:translate-x-1">
                    Read guide &rarr;
                  </span>
                </div>
              </div>

              {/* Right: thumbnail image */}
              <div className="relative min-h-[18rem] md:min-h-[22rem]">
                <Image
                  src={featuredArticle.thumbnailImage}
                  alt={featuredArticle.title}
                  width={1200}
                  height={800}
                  className="absolute inset-0 h-full w-full object-cover md:rounded-r-xl transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#252D6B]/40 to-transparent md:rounded-r-xl" />
              </div>
            </Link>
          </div>
        </ScrollReveal>

        {/* ---------------------------------------------------------------- */}
        {/* 3. Remaining articles grid (2x2)                                 */}
        {/* ---------------------------------------------------------------- */}
        <div className="mx-auto max-w-6xl px-4 mt-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {remainingArticles.map((article, i) => (
              <ScrollReveal key={article.slug} delay={i * 100}>
                <Link
                  href={`/learn/${article.slug}`}
                  className="group relative flex flex-col justify-end overflow-hidden rounded-xl border border-white/10 min-h-[20rem] sm:min-h-[26rem] transition-all duration-300 hover:border-[#F78E42]/40 hover:-translate-y-2 hover:shadow-2xl hover:shadow-[#F78E42]/10"
                >
                  {/* Full-bleed card image */}
                  <Image
                    src={article.thumbnailImage}
                    alt={article.title}
                    width={600}
                    height={400}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />

                  {/* Gradient overlay — branded navy instead of generic black */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#252D6B] via-[#252D6B]/50 to-transparent" />

                  {/* Sticker-style reading time badge */}
                  <span
                    className="absolute top-4 right-4 z-10 rounded-full bg-[#F78E42]/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg"
                    style={{ transform: "rotate(2deg)" }}
                  >
                    {article.readingTimeMin} min
                  </span>

                  {/* Text content overlaid at bottom */}
                  <div className="relative z-10 p-6 sm:p-8">
                    <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl drop-shadow-lg">
                      {article.title}
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-gray-200/80 line-clamp-2">
                      {article.description}
                    </p>
                    <span className="mt-4 inline-block text-xs font-bold text-[#F78E42] opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1">
                      Read guide &rarr;
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
          <section className="mx-auto max-w-6xl px-4 mt-20 mb-20">
            <p
              className="mb-2 text-xs font-bold uppercase tracking-widest text-[#F78E42]"
              style={{ transform: "rotate(-1deg)" }}
            >
              Keep Going
            </p>
            <h2 className="mb-8 font-display text-2xl font-extrabold text-white sm:text-3xl">
              More from Quiver
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {CROSS_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-[#F78E42]/40 hover:bg-[#F78E42]/[0.06] hover:-translate-y-1"
                >
                  {/* Left accent on hover */}
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#F78E42] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="flex items-center justify-between">
                    <span className="block font-display text-base font-bold text-gray-200 transition-colors duration-200 group-hover:text-white">
                      {link.label}
                    </span>
                    <span className="text-[#F78E42] opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1">
                      &rarr;
                    </span>
                  </div>
                  <span className="mt-2 block text-sm leading-relaxed text-gray-500">
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
