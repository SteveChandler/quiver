import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { RoughEdgeFilter } from "@/components/beach-detail/zine/atoms";
import { LaunchBlogLink } from "@/components/blog/launch-blog-link";
import { ArticleSchema } from "@/components/seo/article-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuiverSticker } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import { getAllBlogPosts, getBlogPost } from "@/lib/data/blog-posts";
import { buildPageMetadata } from "@/lib/seo/meta";

export const revalidate = 604800;

interface Props {
  params: Promise<{ slug: string }>;
}

const SECTION_ROTATIONS = ["rot-1", "rot-2", "rot-3", "rot-neg"] as const;

function formatPostDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

function getSectionRotation(index: number): (typeof SECTION_ROTATIONS)[number] {
  return SECTION_ROTATIONS[index % SECTION_ROTATIONS.length];
}

export function generateStaticParams(): { slug: string }[] {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  const metadata = buildPageMetadata({
    title: post.seoTitle,
    description: post.seoDescription,
    path: `/blog/${post.slug}`,
    keywords: post.keywords,
    image: `/api/og/guide?title=${encodeURIComponent(post.title)}&region=Blog`,
  });

  return {
    ...metadata,
    authors: [{ name: post.author }],
    category: "Surf forecasting",
    openGraph: {
      ...(metadata.openGraph ?? {}),
      type: "article",
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified ?? post.datePublished,
      authors: [post.author],
      tags: post.keywords,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const breadcrumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Blog", url: `${SITE_URL}/blog` },
    { name: post.title, url: `${SITE_URL}/blog/${post.slug}` },
  ];

  const toc = post.sections.map((section) => ({
    id: section.id,
    label: section.heading,
  }));

  return (
    <>
      <BreadcrumbStructuredData items={breadcrumbs} />
      <WebPageSchema
        name={post.title}
        description={post.description}
        url={`${SITE_URL}/blog/${post.slug}`}
        dateModified={post.dateModified}
      />
      <ArticleSchema
        title={post.title}
        description={post.description}
        url={`${SITE_URL}/blog/${post.slug}`}
        imageUrl={post.heroImage}
        datePublished={post.datePublished}
        dateModified={post.dateModified}
        author={post.author}
        wordCount={post.wordCount}
        articleSection="Surf forecasting"
        keywords={post.keywords}
        type="BlogPosting"
      />

      <div className="zine-page zine-tab min-h-screen bg-[#0D1020]">
        <RoughEdgeFilter />
        <div className="zine-stage pt-24">
          {/* No masthead: the app header above already carries the Quiver
              wordmark, so a masthead reads as a second header. */}

          <article
            className="zine-paper overflow-hidden"
            data-testid="blog-post-zine-paper"
          >
            <QuiverSticker
              sticker="halftoneCircle"
              className="pointer-events-none !absolute -left-16 top-24 w-48 -rotate-12 opacity-35 mix-blend-multiply"
              sizes="12rem"
            />
            <QuiverSticker
              sticker="blackBrushScrap"
              className="pointer-events-none !absolute bottom-28 right-8 hidden w-28 rotate-12 opacity-25 mix-blend-multiply md:block"
              sizes="7rem"
            />
            <QuiverSticker
              sticker="orangeTape"
              className="pointer-events-none !absolute right-10 top-8 hidden w-28 rotate-12 opacity-80 md:block"
              sizes="7rem"
            />

            <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
              <div>
                <nav className="mb-6 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#11100D]/60">
                  <Link href="/" className="hover:text-[#0B3A75]">
                    Home
                  </Link>
                  <span className="mx-2 select-none">/</span>
                  <Link href="/blog" className="hover:text-[#0B3A75]">
                    Blog
                  </Link>
                </nav>

                <p className="label-black mb-5 w-fit">Founder note</p>
                <h1 className="zine-h1 font-heading uppercase leading-[0.95] tracking-normal text-[#11100D]">
                  {post.title}
                </h1>
                <p className="mt-5 max-w-3xl text-xl leading-8 text-[#11100D]/75">
                  {post.description}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border-2 border-[#11100D] bg-[#FBF6E8] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.18)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <aside className="relative">
                <QuiverSticker
                  sticker={post.sticker}
                  className="absolute -right-9 -top-14 z-20 w-44 rotate-12 drop-shadow-[3px_5px_0_rgba(17,16,13,0.2)] sm:w-52"
                  sizes="13rem"
                />
                <figure className="polaroid rot-2">
                  <div className="photo halftone-photo">
                    <Image
                      src={post.heroImage}
                      alt={post.title}
                      fill
                      priority
                      sizes="(min-width: 1024px) 360px, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <figcaption className="cap">
                    {post.readingTimeMin} min field note
                  </figcaption>
                </figure>
              </aside>
            </header>

            <div className="summary-strip mt-10 !grid-cols-1 md:!grid-cols-[auto_1fr_auto_1fr_auto_1fr]">
              <span className="circled">01</span>
              <p className="typewriter font-bold">
                {post.author}
                <br />
                <span className="opacity-65">Writer</span>
              </p>
              <span className="circled">02</span>
              <p className="typewriter font-bold">
                {formatPostDate(post.datePublished)}
                <br />
                <span className="opacity-65">Posted</span>
              </p>
              <span className="circled">03</span>
              <p className="typewriter font-bold">
                {post.wordCount.toLocaleString()} words
                <br />
                <span className="opacity-65">Read before coffee</span>
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[245px_minmax(0,1fr)]">
              {toc.length > 3 && (
                <ScrollReveal>
                  <nav className="notebook sticky top-24">
                    <p className="mb-4 label-black text-sm">In this note</p>
                    <ol className="space-y-2">
                      {toc.map((item, index) => (
                        <li key={item.id}>
                          <a
                            href={`#${item.id}`}
                            className="group flex items-baseline gap-2 font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#11100D]/70 transition-colors hover:text-[#0B3A75]"
                          >
                            <span className="text-[#F78E42]">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span>{item.label}</span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                </ScrollReveal>
              )}

              <div>
                {post.sections.map((section, index) => (
                  <ScrollReveal key={section.id}>
                    <section
                      className={`torn torn-tb mb-11 border-2 border-[#11100D] bg-[#F0E5CC] ${getSectionRotation(index)}`}
                      id={section.id}
                      style={{ padding: "32px 26px 28px" }}
                    >
                      <span className="tape tl" aria-hidden />
                      <span className="tape br" aria-hidden />
                      <div className="mb-5 flex items-center gap-4">
                        <span className="circled shrink-0">{index + 1}</span>
                        <h2 className="font-heading text-3xl font-bold uppercase tracking-normal text-[#11100D]">
                          {section.heading}
                        </h2>
                      </div>

                      <div className="space-y-5 text-base leading-8 text-[#11100D]/75 sm:text-lg">
                        {section.paragraphs.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>

                      {section.metrics && (
                        <div className="utility-strip mt-8 overflow-hidden border-2 border-[#11100D] bg-[#FBF6E8]">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b-2 border-[#11100D] font-mono text-xs uppercase tracking-widest text-[#11100D]">
                              <tr>
                                <th className="px-4 py-3 font-bold">
                                  Metric
                                </th>
                                <th className="px-4 py-3 text-right font-bold">
                                  Value
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {section.metrics.map((metric) => (
                                <tr
                                  key={metric.label}
                                  className="border-t border-[#11100D]/20 text-[#11100D]/75"
                                >
                                  <td className="px-4 py-3">{metric.label}</td>
                                  <td className="px-4 py-3 text-right font-mono font-bold text-[#0B3A75]">
                                    {metric.value}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {section.bullets && (
                        <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                          {section.bullets.map((bullet) => (
                            <li
                              key={bullet}
                              className="flex items-start gap-3 border-2 border-[#11100D] bg-[#FBF6E8] p-3 text-sm font-medium leading-6 text-[#11100D]/75 shadow-[2px_3px_0_rgba(17,16,13,0.15)]"
                            >
                              <span className="mt-1.5 block h-2 w-2 shrink-0 bg-[#F78E42]" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {section.callout && (
                        <blockquote className="notebook rot-1 mt-8">
                          <p className="font-heading text-xl font-semibold leading-8 text-[#11100D]">
                            {section.callout}
                          </p>
                        </blockquote>
                      )}
                    </section>
                  </ScrollReveal>
                ))}
              </div>
            </div>

            <ScrollReveal>
              <section className="mt-14 border-t-2 border-dashed border-[#11100D]/35 pt-8">
                <p className="label-black mb-5">Keep going</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {post.relatedLinks.map((link, index) => (
                    <LaunchBlogLink
                      key={link.href}
                      href={link.href}
                      trackingLabel={link.label}
                      sourceSlug={post.slug}
                      sourceSurface="blog-post"
                      placement="related-links"
                      className={`torn torn-tb group block min-h-48 border-2 border-[#11100D] bg-[#FBF6E8] p-5 text-[#11100D] transition-transform duration-200 hover:-translate-y-1 ${getSectionRotation(index)}`}
                    >
                      <h3 className="font-heading text-xl font-bold uppercase tracking-normal transition-colors group-hover:text-[#0B3A75]">
                        {link.label}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-[#11100D]/70">
                        {link.description}
                      </p>
                      <p className="mt-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#F78E42]">
                        Read next -&gt;
                      </p>
                    </LaunchBlogLink>
                  ))}
                </div>
              </section>
            </ScrollReveal>
          </article>
        </div>
      </div>
    </>
  );
}
