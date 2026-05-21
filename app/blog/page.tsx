import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BlogSchema } from "@/components/seo/blog-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { SITE_URL } from "@/lib/constants/seo";
import { blogPosts } from "@/lib/data/blog-posts";
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

function formatPostDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

export default function BlogIndexPage() {
  const breadcrumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Blog", url: `${SITE_URL}/blog` },
  ];

  const featuredPost = blogPosts[0];

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
        posts={blogPosts.map((post) => ({
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

      <header className="relative overflow-hidden bg-[#0D1020]">
        <div className="absolute inset-0">
          <Image
            src="/images/OceanBeachSurfers.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1020] via-[#252D6B]/75 to-[#0D1020]/55" />
          <div className="noise-texture-subtle absolute inset-0 pointer-events-none" />
        </div>

        <div className="relative mx-auto flex min-h-[72vh] max-w-6xl flex-col justify-end px-4 pb-12 pt-28 sm:px-6 lg:px-8">
          <p className="mb-4 inline-block w-fit rounded-full bg-[#F78E42]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#F78E42]">
            Founder Notes
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight text-[#F0F0F0] sm:text-6xl">
            The Quiver Blog
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#B8C7E0] sm:text-xl">
            Product notes, surf forecast receipts, and the real feedback loop
            behind the forecast that remembers you.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <ScrollReveal>
          <section className="mb-12 grid gap-4 sm:grid-cols-3">
            {CROSS_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-lg border border-[#F0F0F0]/10 bg-[#F0F0F0]/[0.03] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F78E42]/30 hover:bg-[#F78E42]/[0.04]"
              >
                <h2 className="font-display text-lg font-semibold text-[#F0F0F0] transition-colors group-hover:text-[#F78E42]">
                  {link.label}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#B8C7E0]">
                  {link.desc}
                </p>
              </Link>
            ))}
          </section>
        </ScrollReveal>

        {featuredPost && (
          <ScrollReveal>
            <section className="mb-12">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#F78E42]">
                Latest
              </p>
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="group grid overflow-hidden rounded-xl border border-[#F0F0F0]/10 bg-[#252D6B]/55 transition-all duration-300 hover:border-[#F78E42]/40 hover:shadow-2xl hover:shadow-[#F78E42]/10 md:grid-cols-[0.9fr_1.1fr]"
              >
                <div className="relative min-h-[18rem]">
                  <Image
                    src={featuredPost.heroImage}
                    alt={featuredPost.title}
                    fill
                    sizes="(min-width: 768px) 42vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#252D6B]/70 to-transparent md:bg-gradient-to-r" />
                </div>
                <div className="flex flex-col justify-center p-7 sm:p-9">
                  <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-mono text-[#B8C7E0]">
                    <span>{formatPostDate(featuredPost.datePublished)}</span>
                    <span className="text-[#B8C7E0]/40">/</span>
                    <span>{featuredPost.readingTimeMin} min read</span>
                  </div>
                  <h2 className="font-display text-3xl font-bold text-[#F0F0F0] transition-colors group-hover:text-[#F78E42] sm:text-4xl">
                    {featuredPost.title}
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-[#B8C7E0]">
                    {featuredPost.excerpt}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {featuredPost.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#F0F0F0]/10 px-3 py-1 text-xs text-[#B8C7E0]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-6 text-sm font-bold text-[#F78E42] transition-transform duration-200 group-hover:translate-x-1">
                    Read the note &rarr;
                  </p>
                </div>
              </Link>
            </section>
          </ScrollReveal>
        )}

        <ScrollReveal>
          <section>
            <h2 className="mb-5 font-display text-2xl font-semibold text-[#F0F0F0]">
              All Posts
            </h2>
            <div className="grid gap-4">
              {blogPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group rounded-lg border border-[#F0F0F0]/10 bg-[#F0F0F0]/[0.03] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F78E42]/30 hover:bg-[#F78E42]/[0.04]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="mb-2 text-xs font-mono text-[#B8C7E0]/60">
                        {formatPostDate(post.datePublished)} /{" "}
                        {post.readingTimeMin} min read
                      </p>
                      <h3 className="font-display text-xl font-semibold text-[#F0F0F0] transition-colors group-hover:text-[#F78E42]">
                        {post.title}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#B8C7E0]">
                        {post.description}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[#F78E42]">
                      Read &rarr;
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </ScrollReveal>
      </main>
    </>
  );
}
