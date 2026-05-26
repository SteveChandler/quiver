import {
  blogPosts,
  getAllBlogPosts,
  getFeaturedBlogPost,
  getLatestBlogModifiedDate,
  getNextBlogPost,
  sortBlogPosts,
  type BlogPost,
} from "@/lib/data/blog-posts";

function makePost(
  slug: string,
  datePublished: string,
  title: string,
  dateModified?: string,
): BlogPost {
  return {
    slug,
    title,
    seoTitle: title,
    description: `${title} description`,
    seoDescription: `${title} SEO description`,
    excerpt: `${title} excerpt`,
    author: "Quiver",
    readingTimeMin: 3,
    datePublished,
    dateModified,
    heroImage: "/images/learn/learn-surfer-watching.jpg",
    sticker: "blogClearerCall",
    tags: ["Founder notes"],
    keywords: ["surf forecast"],
    sections: [
      {
        id: "intro",
        heading: "Intro",
        paragraphs: ["Paragraph"],
      },
    ],
    relatedLinks: [
      {
        label: "Forecast Accuracy",
        href: "/forecast-accuracy",
        description: "Forecast accuracy details.",
      },
    ],
    wordCount: 700,
  };
}

describe("blog post helpers", () => {
  it("includes the launch founder note and SEO guide", () => {
    expect(blogPosts.map((post) => post.slug)).toEqual(
      expect.arrayContaining([
        "why-quiver-is-built-around-one-surf-call",
        "how-to-pick-a-surf-spot-before-dawn",
      ]),
    );
  });

  it("keeps every post ready for metadata, schema, and internal linking", () => {
    for (const post of blogPosts) {
      expect(post.title).toEqual(expect.any(String));
      expect(post.seoTitle).toEqual(expect.any(String));
      expect(post.seoDescription).toEqual(expect.any(String));
      expect(post.sticker).toEqual(expect.any(String));
      expect(post.keywords.length).toBeGreaterThan(0);
      expect(post.sections.length).toBeGreaterThan(0);
      expect(post.relatedLinks.length).toBeGreaterThan(0);

      for (const link of post.relatedLinks) {
        expect(link.href.startsWith("/")).toBe(true);
      }
    }
  });

  it("sorts posts by published date descending with title fallback", () => {
    const sorted = sortBlogPosts([
      makePost("b-post", "2026-05-22", "B Post"),
      makePost("old-post", "2026-05-20", "Old Post"),
      makePost("a-post", "2026-05-22", "A Post"),
    ]);

    expect(sorted.map((post) => post.slug)).toEqual([
      "a-post",
      "b-post",
      "old-post",
    ]);
  });

  it("returns a sorted copy for route consumers", () => {
    const allPosts = getAllBlogPosts();

    expect(allPosts).not.toBe(blogPosts);
    expect(allPosts).toEqual(sortBlogPosts(blogPosts));
  });

  it("uses the sorted latest post as the featured post", () => {
    expect(getFeaturedBlogPost()).toEqual(getAllBlogPosts()[0] ?? null);
  });

  it("returns the newest modified date for sitemap freshness", () => {
    const latestModifiedDate = getAllBlogPosts()
      .map((post) => post.dateModified ?? post.datePublished)
      .sort()
      .at(-1);

    expect(getLatestBlogModifiedDate()).toBe(latestModifiedDate);
  });

  it("uses sorted order for next-post navigation", () => {
    const allPosts = getAllBlogPosts();

    expect(getNextBlogPost(allPosts[0].slug)).toEqual(allPosts[1]);
  });
});
