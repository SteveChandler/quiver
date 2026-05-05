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
  {
    href: "/vs/surfline",
    label: "Quiver vs Surfline",
    desc: "See how we compare, feature by feature",
  },
];

const CATEGORIES: { label: string; desc: string; slugs: string[] }[] = [
  {
    label: "Forecast Fundamentals",
    desc: "Read forecasts like a local — height, period, direction, wind, and tide.",
    slugs: [
      "how-to-read-a-surf-forecast",
      "swell-period-explained",
      "offshore-vs-onshore-wind-surfing",
      "best-tide-for-surfing",
      "how-are-waves-measured",
      "wind-swell-vs-ground-swell",
      "how-swell-direction-affects-surf",
      "how-swell-wraps-around-points",
      "how-accurate-are-surf-forecasts",
      "how-surf-forecasts-work",
      "how-quiver-calibrates-your-beach",
    ],
  },
  {
    label: "Timing & Conditions",
    desc: "Know when to paddle out and what to wear.",
    slugs: [
      "best-time-of-day-to-surf",
      "why-waves-better-in-morning",
      "is-it-safe-to-surf-after-rain",
      "what-wetsuit-thickness-do-i-need",
    ],
  },
  {
    label: "Getting Started",
    desc: "Gear, etiquette, and what to expect as a beginner.",
    slugs: [
      "best-surf-conditions-for-beginners",
      "what-size-surfboard-should-i-get",
      "how-long-to-learn-to-surf",
      "surf-etiquette-rules",
      "beach-break-vs-reef-break-vs-point-break",
      "what-equipment-to-start-surfing",
      "what-is-a-rip-current",
    ],
  },
  {
    label: "Ocean Science",
    desc: "How waves and tides actually work.",
    slugs: ["how-are-ocean-waves-formed", "how-do-tides-work"],
  },
];

export default function LearnHubPage() {
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Learn", url: "/learn" },
  ];

  const featuredArticle = learnArticles[0];

  // Group articles by category, excluding the featured article
  const categorized = CATEGORIES.map((cat) => ({
    ...cat,
    articles: cat.slugs
      .map((slug) => learnArticles.find((a) => a.slug === slug))
      .filter(
        (a): a is (typeof learnArticles)[number] =>
          a != null && a.slug !== featuredArticle.slug,
      ),
  })).filter((cat) => cat.articles.length > 0);

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
      <section className="relative h-[80vh] md:h-[85vh] flex items-center justify-center overflow-hidden bg-[#0A0E27]">
        {/* 1. Blurred Background layer (fills the wide space) */}
        <Image
          src="/3sunset_learn_smarter_best.png"
          alt=""
          fill
          className="object-cover blur-3xl opacity-40 scale-110"
          unoptimized
          priority
        />
        
        {/* 2. Main Sharp Image (full-width hero) */}
        <Image
          src="/learn-hero-16x9.webp"
          alt="Surfers walking toward the ocean at sunset with Learn to Surf Smarter text"
          fill
          className="object-cover object-bottom contrast-[1.10] saturate-[1.3] brightness-[1.05] drop-shadow-2xl"
          quality={100}
          unoptimized
          priority
        />

        {/* Lighter gradient overlay since text is baked into image */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#252D6B]/60 via-transparent to-transparent" />

        {/* Noise texture overlay */}
        <div className="noise-texture-subtle absolute inset-0 pointer-events-none" />

        {/* Hero content - sr-only since typography is already in the image */}
        <div className="sr-only">
          <h1>Learn to Surf Smarter</h1>
        </div>
      </section>

      <main>
        {/* Introduction moved below hero image to prevent text overlap */}
        <section className="mx-auto max-w-6xl px-4 mt-12 mb-16 sm:mt-16 sm:mb-20">
          <ScrollReveal>
            <div className="max-w-3xl">
              <p className="mb-6 inline-block rounded-full bg-[#F78E42]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#F78E42]">
                Quiver Guides
              </p>
              <p className="text-xl leading-relaxed text-gray-300 sm:text-2xl font-light">
                Understanding the ocean makes every session better. These guides
                break down surf forecasting, wave science, and conditions — so you
                know exactly what to look for before you paddle out.
              </p>
            </div>
          </ScrollReveal>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 2. Featured article — full-width split card                      */}
        {/* ---------------------------------------------------------------- */}
        <ScrollReveal>
          <div className="relative z-20 mx-auto max-w-6xl px-4">
            <Link
              href={`/learn/${featuredArticle.slug}`}
              className="group grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-[#252D6B]/60 backdrop-blur-sm transition-all duration-300 hover:border-[#F78E42]/40 hover:shadow-2xl hover:shadow-[#F78E42]/10"
            >
              {/* Orange left accent bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F78E42] rounded-l-xl" />

              {/* Left: text content */}
              <div className="flex flex-col justify-center p-8 sm:p-10">
                <p className="mb-3 inline-block w-fit rounded-full bg-[#F78E42]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#F78E42]">
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
        {/* 3. Categorized articles                                          */}
        {/* ---------------------------------------------------------------- */}
        {categorized.map((cat) => (
          <section key={cat.label} className="mx-auto max-w-6xl px-4 mt-16">
            <ScrollReveal>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#F78E42]">
                {cat.label}
              </p>
              <p className="mb-6 text-sm text-gray-400">{cat.desc}</p>
            </ScrollReveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {cat.articles.map((article, i) => (
                <ScrollReveal key={article.slug} delay={i * 80}>
                  <Link
                    href={`/learn/${article.slug}`}
                    className="group relative flex flex-col justify-end overflow-hidden rounded-xl border border-white/10 min-h-[16rem] sm:min-h-[20rem] transition-all duration-300 hover:border-[#F78E42]/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#F78E42]/10"
                  >
                    <Image
                      src={article.thumbnailImage}
                      alt={article.title}
                      width={600}
                      height={400}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#252D6B] via-[#252D6B]/60 to-transparent" />
                    <span className="absolute top-3 right-3 z-10 rounded-full bg-[#F78E42]/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
                      {article.readingTimeMin} min
                    </span>
                    <div className="relative z-10 p-5 sm:p-6">
                      <h2 className="font-display text-lg font-extrabold text-white sm:text-xl drop-shadow-lg line-clamp-2">
                        {article.title}
                      </h2>
                      <p className="mt-2 text-xs leading-relaxed text-gray-200/70 line-clamp-2">
                        {article.description}
                      </p>
                      <span className="mt-3 inline-block text-xs font-bold text-[#F78E42] opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1">
                        Read &rarr;
                      </span>
                    </div>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </section>
        ))}

        {/* ---------------------------------------------------------------- */}
        {/* 4. Cross-links section                                           */}
        {/* ---------------------------------------------------------------- */}
        <ScrollReveal>
          <section className="mx-auto max-w-6xl px-4 mt-20 mb-20">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#F78E42]">
              Keep Going
            </p>
            <h2 className="mb-8 font-display text-2xl font-extrabold text-white sm:text-3xl">
              More from Quiver
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
