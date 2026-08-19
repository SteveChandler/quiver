import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { learnArticles } from "@/lib/data/learn-articles";
import { buildPageMetadata } from "@/lib/seo/meta";
import type { QuiverStickerKey } from "@/lib/ui/quiver-sticker-assets";

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

const CROSS_LINKS: {
  href: string;
  label: string;
  desc: string;
  sticker: QuiverStickerKey;
}[] = [
  {
    href: "/guides",
    label: "Regional Surf Guides",
    desc: "Explore 10+ coastal regions",
    sticker: "orangeMap",
  },
  {
    href: "/forecast-accuracy",
    label: "Forecast Accuracy",
    desc: "See the method, ground truth, and limits",
    sticker: "spotSwellMatch",
  },
  {
    href: "/best-time-to-surf",
    label: "Best Time to Surf",
    desc: "Monthly surf quality by city",
    sticker: "spotTideWindow",
  },
  {
    href: "/vs/surfline",
    label: "Quiver vs Surfline",
    desc: "See how we compare, feature by feature",
    sticker: "goldRightArrow",
  },
];

const CATEGORIES: {
  label: string;
  desc: string;
  slugs: string[];
  sticker: QuiverStickerKey;
}[] = [
  {
    label: "Forecast Fundamentals",
    desc: "Read forecasts like a local: height, period, direction, wind, and tide.",
    sticker: "spotSwellMatch",
    slugs: [
      "how-to-read-surf-conditions",
      "swell-period-explained",
      "offshore-vs-onshore-wind-surfing",
      "best-tide-for-surfing",
      "how-are-waves-measured",
      "groundswell-vs-wind-swell",
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
    sticker: "spotWindRead",
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
    sticker: "singleFin",
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
    sticker: "breakingWave",
    slugs: ["how-are-ocean-waves-formed", "how-do-tides-work"],
  },
  {
    label: "Local Beginner Breaks",
    desc: "Beginner-friendly local lineups and what to check before you go.",
    sticker: "spotLocation",
    slugs: ["beginner-breaks-san-diego", "beginner-breaks-santa-cruz"],
  },
];

export default function LearnHubPage() {
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Learn", url: "/learn" },
  ];

  const featuredArticle =
    learnArticles.find((article) => article.slug === "groundswell-vs-wind-swell") ??
    learnArticles[0];
  const categorized = CATEGORIES.map((cat) => ({
    ...cat,
    articles: cat.slugs
      .map((slug) => learnArticles.find((article) => article.slug === slug))
      .filter(
        (article): article is (typeof learnArticles)[number] =>
          article != null && article.slug !== featuredArticle.slug,
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

      <ZineSurface
        sectionLabel="Learn"
        editionLabel="Forecast field notes"
        data-testid="learn-zine-surface"
      >
        <main>
          <header className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <ScrollReveal>
              <div className="relative">
                <QuiverSticker
                  sticker="creamTape"
                  className="absolute -top-8 right-4 hidden w-32 rotate-6 opacity-85 sm:block"
                />
                <p className="label-black mb-5">Quiver Guides</p>
                <h1 className="zine-h1 font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
                  Learn to Surf Smarter
                </h1>
                <p className="mt-6 max-w-2xl text-xl leading-relaxed text-[#11100D]/75 sm:text-2xl">
                  Forecast basics, wave science, and beginner field notes for
                  reading the ocean before you paddle out.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
                  <span>{learnArticles.length} guides</span>
                  <span aria-hidden>/</span>
                  <span>Updated weekly</span>
                  <span aria-hidden>/</span>
                  <span>Made for dawn checks</span>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={80}>
              <Link
                href={`/learn/${featuredArticle.slug}`}
                className="group polaroid rot-2 block"
              >
                <div className="photo">
                  <Image
                    src={featuredArticle.thumbnailImage}
                    alt={featuredArticle.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(min-width: 1024px) 480px, 100vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-[#252D6B]/20 mix-blend-multiply" />
                  <QuiverSticker
                    sticker="breakingWave"
                    className="absolute -bottom-7 -right-5 w-32 rotate-6 drop-shadow-md"
                  />
                </div>
                <p className="cap">{featuredArticle.title}</p>
                <p className="mt-2 px-2 pb-2 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[#11100D]/60">
                  Featured guide / {featuredArticle.readingTimeMin} min read
                </p>
              </Link>
            </ScrollReveal>
          </header>

          <ScrollReveal>
            <section className="torn torn-tb rot-neg mt-12 border-2 border-[#11100D]">
              <div className="grid gap-5 md:grid-cols-[0.95fr_1.05fr] md:items-center">
                <div>
                  <p className="typewriter mb-2">Start here</p>
                  <h2 className="font-display text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl">
                    {featuredArticle.title}
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-[#11100D]/72">
                    {featuredArticle.description}
                  </p>
                </div>
                <div className="notebook">
                  <p className="font-handwritten text-2xl leading-tight text-[#11100D]">
                    Read height, period, wind, tide, and direction together.
                  </p>
                  <Link
                    href={`/learn/${featuredArticle.slug}`}
                    className="mt-5 inline-flex items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-4 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
                  >
                    Read guide <span className="ml-2">&rarr;</span>
                  </Link>
                </div>
              </div>
            </section>
          </ScrollReveal>

          {categorized.map((cat, categoryIndex) => (
            <section key={cat.label} className="mt-14">
              <ScrollReveal>
                <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
                  <div>
                    <p className="typewriter mb-2">Stack {categoryIndex + 1}</p>
                    <h2 className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
                      {cat.label}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#11100D]/68">
                      {cat.desc}
                    </p>
                  </div>
                  <QuiverSticker
                    sticker={cat.sticker}
                    className="hidden w-16 shrink-0 rotate-6 drop-shadow-sm sm:block"
                  />
                </div>
              </ScrollReveal>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {cat.articles.map((article, articleIndex) => (
                  <ScrollReveal key={article.slug} delay={articleIndex * 60}>
                    <Link
                      href={`/learn/${article.slug}`}
                      className="group torn flex min-h-[22rem] flex-col overflow-hidden border-2 border-[#11100D] bg-[#FBF6E8] transition-transform hover:-translate-y-1"
                    >
                      <div className="relative mb-4 h-36 overflow-hidden border-2 border-[#11100D] bg-[#C8C2B0]">
                        <Image
                          src={article.thumbnailImage}
                          alt={article.title}
                          fill
                          className="object-cover saturate-[0.75] transition-transform duration-500 group-hover:scale-105"
                          sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw"
                        />
                        <div className="absolute inset-0 bg-[#F4EBD8]/10 mix-blend-screen" />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="mb-3 flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[#11100D]/55">
                          <span>{article.readingTimeMin} min</span>
                          <span>Guide {String(articleIndex + 1).padStart(2, "0")}</span>
                        </div>
                        <h3 className="font-display text-xl font-black uppercase leading-tight text-[#11100D] transition-colors group-hover:text-[#B56A2B]">
                          {article.title}
                        </h3>
                        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#11100D]/68">
                          {article.description}
                        </p>
                        <span className="mt-auto pt-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#B56A2B]">
                          Open note &rarr;
                        </span>
                      </div>
                    </Link>
                  </ScrollReveal>
                ))}
              </div>
            </section>
          ))}

          <ScrollReveal>
            <section className="mt-16">
              <p className="label-black mb-6">Keep Going</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {CROSS_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group torn relative flex min-h-44 flex-col overflow-hidden border-2 border-[#11100D] bg-[#F0E5CC] p-5 transition-transform hover:-translate-y-1"
                  >
                    <QuiverSticker
                      sticker={link.sticker}
                      className="absolute -right-4 -top-4 w-16 rotate-12 opacity-80 transition-transform group-hover:rotate-6"
                    />
                    <span className="relative z-10 font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                      {link.label}
                    </span>
                    <span className="relative z-10 mt-3 block text-sm leading-relaxed text-[#11100D]/68">
                      {link.desc}
                    </span>
                    <span className="relative z-10 mt-auto pt-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#B56A2B]">
                      Visit &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </ScrollReveal>
        </main>
      </ZineSurface>

      <StickySignupBar source="learn_hub" />
    </>
  );
}
