import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roadmap — what's next in Quiver",
  description:
    "See what we've shipped, what we're building, and what's next. Vote on features and suggest what matters to you.",
  alternates: { canonical: "/roadmap" },
  openGraph: {
    title: "Quiver Roadmap",
    description:
      "Public roadmap for Quiver — the surf app that tells you when to paddle out. Vote on what ships next.",
    url: "https://www.quiversurf.app/roadmap",
    type: "website",
  },
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Quiver Roadmap",
            description:
              "Public roadmap for Quiver surf app — shipped, in progress, and under consideration features.",
            url: "https://www.quiversurf.app/roadmap",
          }),
        }}
      />
      {children}
    </>
  );
}
