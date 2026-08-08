import type { Metadata } from "next";
import Image from "next/image";

import { RoughEdgeFilter } from "@/components/beach-detail/zine/atoms";
import { LaunchBlogLink } from "@/components/blog/launch-blog-link";
import { BlogSchema } from "@/components/seo/blog-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuiverSticker } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import { getAllBlogPosts, getFeaturedBlogPost } from "@/lib/data/blog-posts";
import { buildPageMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildPageMetadata({
  title: "Quiver Blog: Surf Forecast Notes",
  description:
    "Founder notes on surf forecasts, session logs, forecast accuracy, and how Quiver learns from surfers, buoys, and local observations.",
  path: "/blog",
  keywords: [
    "Quiver blog",
    "surf forecast blog",
    "surf session log",
    "forecast transparency",
    "surf app roadmap",
  ],
});

const CROSS_LINKS = [
  {
    href: "/roadmap",
    label: "Roadmap",
    desc: "Vote on what Quiver should build next.",
  },
  {
    href: "/learn",
    label: "Learn",
    desc: "Forecast guides, wave science, and beginner surf explainers.",
  },
  {
    href: "/forecast-accuracy",
    label: "Forecast Accuracy",
    desc: "See how Quiver checks forecasts against buoy truth.",
  },
];

const CARD_ROTATIONS = ["rot-1", "rot-2", "rot-3"] as const;

function formatPostDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

function getCardRotation(index: number): (typeof CARD_ROTATIONS)[number] {
  return CARD_ROTATIONS[index % CARD_ROTATIONS.length];
}

export default function BlogIndexPage() {
  const allPosts = getAllBlogPosts();
  const featuredPost = getFeaturedBlogPost();
  const breadcrumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Blog", url: `${SITE_URL}/blog` },
  ];

  return (
    <>
      <BreadcrumbStructuredData items={breadcrumbs} />
      <WebPageSchema
        name="Quiver Blog: Surf Forecast Notes"
        description="Founder notes on surf forecasts, session logs, forecast accuracy, and how Quiver learns from surfers, buoys, and local observations."
        url={`${SITE_URL}/blog`}
      />
      <BlogSchema
        name="Quiver Blog"
        description="Founder notes on surf forecasts, session logs, forecast accuracy, and how Quiver learns from surfers, buoys, and local observations."
        url={`${SITE_URL}/blog`}
        posts={allPosts.map((post) => ({
          title: post.title,
          description: post.seoDescription,
          url: `${SITE_URL}/blog/${post.slug}`,
          datePublished: post.datePublished,
          dateModified: post.dateModified,
          author: post.author,
          imageUrl: post.heroImage,
          keywords: post.keywords,
        }))}
      />

      <div className="zine-page zine-tab min-h-screen bg-[#0D1020]">
        <RoughEdgeFilter />
        <div className="zine-stage pt-24">
          {/* No masthead: the app header above already carries the Quiver
              wordmark, so a masthead reads as a second header. */}

          <main className="zine-paper overflow-hidden">
            <QuiverSticker
              sticker="halftoneCircle"
              className="pointer-events-none !absolute -left-14 top-14 w-52 -rotate-12 opacity-35 mix-blend-multiply"
              sizes="13rem"
            />
            <QuiverSticker
              sticker="orangeTape"
              className="pointer-events-none !absolute left-16 top-7 w-28 -rotate-12 opacity-85"
              sizes="7rem"
            />
            <QuiverSticker
              sticker="navyLightning"
              className="pointer-events-none !absolute right-10 top-12 hidden w-32 rotate-12 opacity-35 mix-blend-multiply md:block"
              sizes="8rem"
            />

            <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
              <div>
                <p className="label-black mb-5 w-fit">Founder notes</p>
                <h1 className="zine-h1 font-heading uppercase leading-[0.95] tracking-normal text-[#11100D]">
                  The Quiver Blog
                </h1>
                <p className="mt-5 max-w-2xl text-xl leading-8 text-[#11100D]/75">
                  Raw product notes, surf forecast receipts, and the feedback
                  loop behind calls that try to beat the chart shuffle.
                </p>
              </div>

              <aside className="notebook rot-2">
                <p className="font-heading text-2xl font-bold uppercase text-[#11100D]">
                  What belongs here
                </p>
                <p className="mt-4 text-base leading-7 text-[#11100D]/75">
                  Founder notes, useful surf planning, forecast transparency,
                  and session-log learning. No generic lifestyle filler.
                </p>
              </aside>
            </header>

            <ScrollReveal>
              <section className="mt-12 grid gap-4 sm:grid-cols-3">
                {CROSS_LINKS.map((link, index) => (
                  <LaunchBlogLink
                    key={link.href}
                    href={link.href}
                    trackingLabel={link.label}
                    sourceSlug="blog-index"
                    sourceSurface="blog-index"
                    placement="hub-cross-link"
                    className={`torn torn-tb group block min-h-40 border-2 border-[#11100D] bg-[#FBF6E8] p-5 text-[#11100D] transition-transform duration-200 hover:-translate-y-1 ${getCardRotation(index)}`}
                  >
                    <h2 className="font-heading text-xl font-bold uppercase tracking-normal transition-colors group-hover:text-[#0B3A75]">
                      {link.label}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-[#11100D]/70">
                      {link.desc}
                    </p>
                  </LaunchBlogLink>
                ))}
              </section>
            </ScrollReveal>

            {featuredPost && (
              <ScrollReveal>
                <section className="mt-14">
                  <p className="label-black mb-5 w-fit">Latest</p>
                  <LaunchBlogLink
                    href={`/blog/${featuredPost.slug}`}
                    trackingLabel={featuredPost.title}
                    sourceSlug="blog-index"
                    sourceSurface="blog-index"
                    placement="featured-post"
                    className="torn torn-tb group grid overflow-hidden border-2 border-[#11100D] bg-[#F0E5CC] text-[#11100D] transition-transform duration-300 hover:-translate-y-1 md:grid-cols-[0.82fr_1.18fr]"
                  >
                    <div className="relative min-h-[20rem] border-b-2 border-[#11100D] md:border-b-0 md:border-r-2">
                      <div className="halftone-photo !absolute inset-0">
                        <Image
                          src={featuredPost.heroImage}
                          alt={featuredPost.title}
                          fill
                          sizes="(min-width: 768px) 40vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <QuiverSticker
                        sticker={featuredPost.sticker}
                        className="absolute -right-8 -top-8 z-20 w-44 rotate-12 drop-shadow-[3px_5px_0_rgba(17,16,13,0.18)]"
                        sizes="11rem"
                      />
                    </div>
                    <div className="flex flex-col justify-center p-7 sm:p-9">
                      <div className="mb-5 flex flex-wrap items-center gap-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D]/60">
                        <span>{formatPostDate(featuredPost.datePublished)}</span>
                        <span>/</span>
                        <span>{featuredPost.readingTimeMin} min read</span>
                      </div>
                      <h2 className="font-heading text-4xl font-bold uppercase leading-none tracking-normal text-[#11100D] transition-colors group-hover:text-[#0B3A75]">
                        {featuredPost.title}
                      </h2>
                      <p className="mt-5 text-base leading-7 text-[#11100D]/75">
                        {featuredPost.excerpt}
                      </p>
                      <div className="mt-6 flex flex-wrap gap-2">
                        {featuredPost.tags.map((tag) => (
                          <span
                            key={tag}
                            className="border-2 border-[#11100D] bg-[#FBF6E8] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#11100D]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="mt-7 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#F78E42] transition-transform duration-200 group-hover:translate-x-1">
                        Read the note -&gt;
                      </p>
                    </div>
                  </LaunchBlogLink>
                </section>
              </ScrollReveal>
            )}

            <ScrollReveal>
              <section className="mt-14 border-t-2 border-dashed border-[#11100D]/35 pt-8">
                <h2 className="label-black mb-6 w-fit">All Posts</h2>
                <div className="grid gap-5">
                  {allPosts.map((post, index) => (
                    <LaunchBlogLink
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      trackingLabel={post.title}
                      sourceSlug="blog-index"
                      sourceSurface="blog-index"
                      placement="all-posts"
                      className={`torn torn-tb group grid gap-5 border-2 border-[#11100D] bg-[#FBF6E8] p-5 text-[#11100D] transition-transform duration-200 hover:-translate-y-1 sm:grid-cols-[94px_minmax(0,1fr)_auto] sm:items-center ${getCardRotation(index)}`}
                    >
                      <QuiverSticker
                        sticker={post.sticker}
                        className="w-24 rotate-6 drop-shadow-[2px_3px_0_rgba(17,16,13,0.14)]"
                        sizes="6rem"
                      />
                      <div>
                        <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D]/55">
                          {formatPostDate(post.datePublished)} /{" "}
                          {post.readingTimeMin} min read
                        </p>
                        <h3 className="font-heading text-2xl font-bold uppercase tracking-normal text-[#11100D] transition-colors group-hover:text-[#0B3A75]">
                          {post.title}
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#11100D]/70">
                          {post.description}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#F78E42]">
                        Read -&gt;
                      </span>
                    </LaunchBlogLink>
                  ))}
                </div>
              </section>
            </ScrollReveal>
          </main>
        </div>
      </div>
    </>
  );
}
