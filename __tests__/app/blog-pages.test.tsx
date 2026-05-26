import { render, screen } from "@testing-library/react";

import BlogIndexPage from "@/app/blog/page";
import BlogPostPage from "@/app/blog/[slug]/page";
import {
  generateMetadata,
  generateStaticParams,
} from "@/app/blog/[slug]/page";
import { getAllBlogPosts, getFeaturedBlogPost } from "@/lib/data/blog-posts";

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: jest.fn() }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill: _fill, priority: _priority, ...props }: any) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

describe("blog pages", () => {
  it("uses helper-backed post order for static params", () => {
    expect(generateStaticParams()).toEqual(
      getAllBlogPosts().map((post) => ({ slug: post.slug })),
    );
  });

  it("builds post metadata from SEO fields", async () => {
    const post = getAllBlogPosts()[0];

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: post.slug }),
    });

    expect(metadata.title).toBe(post.seoTitle);
    expect(metadata.description).toBe(post.seoDescription);
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified ?? post.datePublished,
      authors: [post.author],
      tags: post.keywords,
    });
  });

  it("renders the featured post and all-post list from the finite data helper", () => {
    const featuredPost = getFeaturedBlogPost();

    render(<BlogIndexPage />);

    expect(
      screen.getByRole("heading", { name: /the quiver blog/i }),
    ).toBeInTheDocument();
    expect(featuredPost).not.toBeNull();
    expect(
      screen.getAllByRole("heading", { name: featuredPost?.title }),
    ).toHaveLength(2);
  });

  it("renders post pages with the raw zine paper and post-specific sticker", async () => {
    const post = getAllBlogPosts()[0];

    const Page = await BlogPostPage({
      params: Promise.resolve({ slug: post.slug }),
    });
    const { container } = render(Page);

    expect(screen.getByTestId("blog-post-zine-paper")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /how quiver is built for surfers/i,
      }),
    ).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(/surfline/i);
    expect(
      container.querySelector('[data-zine-sticker="blog-clearer-call"]'),
    ).not.toBeNull();
  });

  it("emits Blog schema entries for every post", () => {
    const { container } = render(<BlogIndexPage />);

    const schemas = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]'),
    ).map((script) => script.textContent ?? "");
    const blogSchema = schemas.find((schema) =>
      schema.includes('"@type":"Blog"'),
    );

    expect(blogSchema).toEqual(expect.any(String));
    for (const post of getAllBlogPosts()) {
      expect(blogSchema ?? "").toContain(`/blog/${post.slug}`);
      expect(blogSchema ?? "").toContain(post.seoDescription);
    }
  });
});
