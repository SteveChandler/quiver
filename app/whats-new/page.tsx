import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";

import { AutoplayVideo } from "@/components/landing-page/field-guide/autoplay-video";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import {
  formatReleaseDate,
  getLatestRelease,
  getPreviousReleases,
  type Release,
  type ReleaseSection,
} from "@/lib/data/whats-new";
import { buildPageMetadata } from "@/lib/seo/meta";

// ISR: static release notes, rarely change.
export const revalidate = 3600;

const PAGE_TITLE = "What's New in Quiver | Release Notes";
const PAGE_DESCRIPTION =
  "Every Quiver release, in plain English: what shipped in the iPhone app and on the website, where to find it, and what we are working on next.";

export const metadata: Metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/whats-new",
  keywords: [
    "Quiver what's new",
    "Quiver release notes",
    "surf app updates",
    "Quiver changelog",
    "surf forecast app new features",
  ],
});

function ReleaseSectionBlock({
  section,
  anchorId,
}: {
  section: ReleaseSection;
  anchorId: string;
}): ReactElement {
  return (
    <section
      id={anchorId}
      className="torn torn-tb scroll-mt-28 border-2 border-[#11100D] bg-[#F0E5CC]"
      style={{ padding: "30px 26px 28px" }}
    >
      <span className="tape tl" aria-hidden />
      <span className="tape br" aria-hidden />

      <div
        className={
          section.preview
            ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-start"
            : undefined
        }
      >
        <div>
          <p className="typewriter mb-3">{section.label}</p>
          <h3 className="font-heading text-2xl font-bold uppercase leading-tight tracking-normal text-[#11100D] sm:text-3xl">
            {section.heading}
          </h3>

          <div className="mt-5 space-y-4 text-base leading-7 text-[#11100D]/78 sm:text-lg sm:leading-8">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {section.bullets && (
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {section.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start gap-3 border-2 border-[#11100D] bg-[#FBF6E8] p-3 text-sm font-medium leading-6 text-[#11100D]/78 shadow-[2px_3px_0_rgba(17,16,13,0.15)]"
                >
                  <span className="mt-2 block h-2 w-2 shrink-0 bg-[#F78E42]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          {section.howTo && (
            <div className="utility-strip mt-7 border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-4">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#11100D]">
                {section.howTo.title}
              </p>
              <ol className="mt-3 space-y-2">
                {section.howTo.steps.map((step, stepIndex) => (
                  <li
                    key={step}
                    className="flex items-start gap-3 text-sm leading-6 text-[#11100D]/78"
                  >
                    <span className="circled shrink-0 text-xs">
                      {stepIndex + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {section.availability && (
            <p className="mt-6 inline-block -rotate-1 border-2 border-dashed border-[#0B3A75] px-3 py-1 font-mono text-xs uppercase tracking-widest text-[#0B3A75]">
              {section.availability}
            </p>
          )}
        </div>

        {section.preview && (
          <figure className="mx-auto w-full max-w-[200px] lg:mx-0 lg:sticky lg:top-28">
            <div className="relative aspect-[9/19.5] overflow-hidden rounded-[24px] border-2 border-[#11100D] bg-[#11100D] shadow-[3px_4px_0_rgba(17,16,13,0.3)]">
              <Image
                src={section.preview.src}
                alt={section.preview.alt}
                fill
                sizes="(min-width: 1024px) 200px, 50vw"
                className="object-cover object-top"
              />
              {section.preview.video && (
                <AutoplayVideo
                  src={section.preview.video}
                  poster={section.preview.src}
                  ariaLabel={section.preview.alt}
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  playLabel="Play"
                  playButtonClassName="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.2)]"
                />
              )}
            </div>
            <figcaption className="pt-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[#11100D]/65">
              App preview · {section.preview.label}
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}

function PreviousRelease({ release }: { release: Release }): ReactElement {
  return (
    <details className="group border-t-2 border-[#11100D]/25 py-5 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-baseline gap-4 [&::-webkit-details-marker]:hidden">
        <span className="typewriter shrink-0 !mb-0">
          {formatReleaseDate(release.date)}
        </span>
        <span className="flex-1">
          <span className="block font-heading text-xl font-bold uppercase leading-snug text-[#11100D] underline decoration-[#F78E42] decoration-2 underline-offset-4 group-hover:decoration-4">
            {release.title}
          </span>
          <span className="mt-1 block text-sm leading-6 text-[#11100D]/70">
            {release.summary}
          </span>
        </span>
        <span
          className="hidden shrink-0 font-mono text-xs uppercase tracking-widest text-[#11100D]/60 sm:block"
          aria-hidden
        >
          <span className="group-open:hidden">Open</span>
          <span className="hidden group-open:inline">Close</span>
        </span>
      </summary>

      <div className="mt-6 space-y-8 pl-0 sm:pl-6">
        {release.intro.map((paragraph) => (
          <p
            key={paragraph}
            className="max-w-3xl text-base leading-7 text-[#11100D]/78"
          >
            {paragraph}
          </p>
        ))}
        {release.sections.map((section) => (
          <ReleaseSectionBlock
            key={section.id}
            section={section}
            anchorId={`${release.slug}-${section.id}`}
          />
        ))}
      </div>
    </details>
  );
}

export default function WhatsNewPage(): ReactElement {
  const latest = getLatestRelease();
  const previous = getPreviousReleases();
  const breadcrumbs = [
    { name: "Home", url: SITE_URL },
    { name: "What's New", url: `${SITE_URL}/whats-new` },
  ];

  return (
    <>
      <BreadcrumbStructuredData items={breadcrumbs} />
      <WebPageSchema
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url={`${SITE_URL}/whats-new`}
      />

      <ZineSurface
        sectionLabel="What's new"
        editionLabel={formatReleaseDate(latest.date)}
        data-testid="whats-new-zine-surface"
        paperClassName="overflow-hidden"
      >
        <QuiverSticker
          sticker="halftoneCircle"
          className="pointer-events-none !absolute -left-14 top-14 w-52 -rotate-12 opacity-35 mix-blend-multiply"
          sizes="13rem"
        />
        <QuiverSticker
          sticker="navyLightning"
          className="pointer-events-none !absolute right-8 top-10 hidden w-28 rotate-12 opacity-35 mix-blend-multiply md:block"
          sizes="7rem"
        />

        <main>
          <header className="relative">
            <QuiverSticker
              sticker="orangeTape"
              className="absolute -top-9 left-2 hidden w-32 -rotate-6 opacity-85 sm:block"
            />
            <ScrollReveal>
              <p className="label-black mb-5 w-fit">Release notes</p>
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <h1 className="zine-h1 font-heading uppercase leading-[0.9] tracking-normal text-[#11100D]">
                What&apos;s New
              </h1>
            </ScrollReveal>
            <ScrollReveal delay={160}>
              <p className="mt-5 max-w-2xl text-xl leading-8 text-[#11100D]/75">
                What shipped in the Quiver app and on the site, where to find
                it, and what we are pointed at next. Newest first.
              </p>
            </ScrollReveal>
          </header>

          <ScrollReveal>
            <nav
              aria-label="Jump to a section"
              className="mt-10 border-y-2 border-[#11100D] py-3"
            >
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#11100D] sm:text-xs">
                <li>
                  <a
                    href="#update-from-the-team"
                    className="underline-offset-4 hover:text-[#B56A2B] hover:underline"
                  >
                    Update from the team
                  </a>
                </li>
                {latest.sections.map((section) => (
                  <li key={section.id} className="flex items-center gap-2">
                    <span aria-hidden className="text-[#11100D]/40">
                      /
                    </span>
                    <a
                      href={`#${section.id}`}
                      className="underline-offset-4 hover:text-[#B56A2B] hover:underline"
                    >
                      {section.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </ScrollReveal>

          <ScrollReveal>
            <section
              id="update-from-the-team"
              className="mt-12 scroll-mt-28 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
            >
              <div>
                <p className="typewriter mb-3">
                  {formatReleaseDate(latest.date)}
                </p>
                <h2 className="font-heading text-4xl font-black uppercase leading-[0.95] tracking-normal text-[#11100D] sm:text-5xl [text-wrap:balance]">
                  {latest.title}
                </h2>
                <div className="mt-6 max-w-3xl space-y-5 text-lg leading-8 text-[#11100D]/78">
                  {latest.intro.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>

              <aside className="notebook rot-2">
                <p className="font-heading text-xl font-bold uppercase text-[#11100D]">
                  In this release
                </p>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-[#11100D]/78">
                  {latest.sections.map((section) => (
                    <li key={section.id} className="flex items-start gap-2">
                      <span className="mt-2 block h-1.5 w-1.5 shrink-0 bg-[#F78E42]" />
                      <a
                        href={`#${section.id}`}
                        className="underline decoration-[#11100D]/30 underline-offset-4 hover:decoration-[#F78E42]"
                      >
                        {section.heading}
                      </a>
                    </li>
                  ))}
                </ul>
              </aside>
            </section>
          </ScrollReveal>

          <div className="mt-12 space-y-11">
            {latest.sections.map((section) => (
              <ScrollReveal key={section.id}>
                <ReleaseSectionBlock section={section} anchorId={section.id} />
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal>
            <section
              className="mt-16 border-t-2 border-dashed border-[#11100D]/35 pt-8"
              aria-labelledby="previous-releases-heading"
            >
              <p className="label-black mb-5 w-fit">Previous releases</p>
              <h2
                id="previous-releases-heading"
                className="font-heading text-3xl font-black uppercase leading-none tracking-normal text-[#11100D]"
              >
                Older notes
              </h2>
              <div data-testid="whats-new-previous" className="mt-6">
                {previous.map((release) => (
                  <PreviousRelease key={release.slug} release={release} />
                ))}
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal>
            <section className="mt-14 border-t-2 border-dashed border-[#11100D]/35 pt-8">
              <p className="label-black mb-5 w-fit">Have a say</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  href="/roadmap"
                  className="group border-2 border-[#11100D] bg-[#FBF6E8] p-5 shadow-[3px_4px_0_rgba(17,16,13,0.25)] transition-transform hover:-translate-y-0.5"
                >
                  <p className="font-heading text-xl font-bold uppercase text-[#11100D]">
                    Vote on what ships next
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#11100D]/70">
                    The roadmap is public. Upvote what matters and see what is
                    in progress.
                  </p>
                </Link>
                <Link
                  href="/support"
                  className="group border-2 border-[#11100D] bg-[#FBF6E8] p-5 shadow-[3px_4px_0_rgba(17,16,13,0.25)] transition-transform hover:-translate-y-0.5"
                >
                  <p className="font-heading text-xl font-bold uppercase text-[#11100D]">
                    Tell us what broke
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#11100D]/70">
                    A wrong window, a bad read, a page that does not load. We
                    want to hear it.
                  </p>
                </Link>
              </div>
            </section>
          </ScrollReveal>
        </main>
      </ZineSurface>
    </>
  );
}
