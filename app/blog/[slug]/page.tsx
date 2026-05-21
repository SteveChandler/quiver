import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { ArticleSchema } from "@/components/seo/article-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { SITE_URL } from "@/lib/constants/seo";
import { blogPosts, getBlogPost } from "@/lib/data/blog-posts";
import { buildPageMetadata } from "@/lib/seo/meta";

export const revalidate = 604800;

interface Props {
  params: Promise<{ slug: string }>;
}

function formatPostDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function generateStaticParams(): { slug: string }[] {
  return blogPosts.map((post) => ({ slug: post.slug }));
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

      <header className="relative min-h-[72vh] overflow-hidden bg-[#0D1020]">
        <Image
          src={post.heroImage}
          alt={post.title}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1020] via-[#252D6B]/85 to-[#0D1020]/45" />
        <div className="noise-texture-subtle absolute inset-0 pointer-events-none" />

        <div className="relative z-10 mx-auto flex min-h-[72vh] max-w-4xl flex-col justify-end px-4 pb-10 pt-28 sm:px-6 lg:px-8">
          <nav className="mb-6 text-sm text-[#B8C7E0]/75">
            <Link href="/" className="transition-colors hover:text-[#F0F0F0]">
              Home
            </Link>
            <span className="mx-2 select-none">/</span>
            <Link href="/blog" className="transition-colors hover:text-[#F0F0F0]">
              Blog
            </Link>
          </nav>

          <div className="mb-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#F78E42]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#F78E42]"
              >
                {tag}
              </span>
            ))}
          </div>

          <h1 className="font-display text-4xl font-bold tracking-tight text-[#F0F0F0] sm:text-6xl">
            {post.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#B8C7E0] sm:text-xl">
            {post.description}
          </p>
          <p className="mt-5 text-sm font-mono text-[#B8C7E0]/75">
            {post.author} / {formatPostDate(post.datePublished)} /{" "}
            {post.readingTimeMin} min read
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {toc.length > 3 && (
          <ScrollReveal>
            <nav className="mb-10 rounded-lg border border-[#F0F0F0]/10 bg-[#F0F0F0]/[0.03] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#B8C7E0]/60">
                In this note
              </p>
              <ol className="space-y-1">
                {toc.map((item, index) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="group flex items-baseline gap-2 text-sm text-[#B8C7E0] transition-colors hover:text-[#F0F0F0]"
                    >
                      <span className="font-mono text-xs text-[#B8C7E0]/40 transition-colors group-hover:text-[#F78E42]">
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

        {post.sections.map((section, index) => (
          <ScrollReveal key={section.id}>
            <section className="mb-14" id={section.id}>
              <div className="mb-4 flex items-baseline gap-3">
                <span className="select-none font-mono text-xs text-[#F78E42]/50">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="font-display text-2xl font-semibold text-[#F0F0F0] sm:text-3xl">
                  {section.heading}
                </h2>
              </div>

              <div className="space-y-5 text-base leading-relaxed text-[#B8C7E0] sm:text-lg">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              {section.metrics && (
                <div className="mt-8 overflow-hidden rounded-lg border border-[#F0F0F0]/10 bg-[#F0F0F0]/[0.03]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#F0F0F0]/[0.05] text-xs uppercase tracking-widest text-[#B8C7E0]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Metric</th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.metrics.map((metric) => (
                        <tr
                          key={metric.label}
                          className="border-t border-[#F0F0F0]/10 text-[#B8C7E0]"
                        >
                          <td className="px-4 py-3">{metric.label}</td>
                          <td className="px-4 py-3 text-right font-mono text-[#00D4AA]">
                            {metric.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {section.bullets && (
                <ul className="mt-6 space-y-3">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-3 text-sm leading-relaxed text-[#B8C7E0] sm:text-base"
                    >
                      <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#F78E42]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              {section.callout && (
                <blockquote className="mt-8 border-l-2 border-[#F78E42] bg-[#F78E42]/[0.04] px-5 py-4">
                  <p className="text-lg leading-relaxed text-[#F0F0F0]">
                    {section.callout}
                  </p>
                </blockquote>
              )}
            </section>
          </ScrollReveal>
        ))}

        <ScrollReveal>
          <section className="mb-12 mt-16 border-t border-[#F0F0F0]/10 pt-10">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#F78E42]">
              Keep going
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {post.relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group rounded-lg border border-[#F0F0F0]/10 bg-[#F0F0F0]/[0.03] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F78E42]/30 hover:bg-[#F78E42]/[0.04]"
                >
                  <h3 className="font-display text-base font-semibold text-[#F0F0F0] transition-colors group-hover:text-[#F78E42]">
                    {link.label}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#B8C7E0]">
                    {link.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </ScrollReveal>
      </main>
    </>
  );
}
