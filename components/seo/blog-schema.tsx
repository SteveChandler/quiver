interface BlogSchemaPost {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  imageUrl: string;
  keywords: string[];
}

interface BlogSchemaProps {
  name: string;
  description: string;
  url: string;
  posts: BlogSchemaPost[];
}

export function BlogSchema({
  name,
  description,
  url,
  posts,
}: BlogSchemaProps) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

  const data = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name,
    description,
    url: fullUrl,
    publisher: {
      "@type": "Organization",
      name: "Quiver",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/quiver-app-icon.png`,
      },
    },
    blogPost: posts.map((post) => {
      const postUrl = post.url.startsWith("http")
        ? post.url
        : `${baseUrl}${post.url}`;
      const imageUrl = post.imageUrl.startsWith("http")
        ? post.imageUrl
        : `${baseUrl}${post.imageUrl}`;

      return {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        url: postUrl,
        image: imageUrl,
        datePublished: post.datePublished,
        dateModified: post.dateModified ?? post.datePublished,
        keywords: post.keywords.join(", "),
        author: {
          "@type": "Person",
          name: post.author,
        },
      };
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
