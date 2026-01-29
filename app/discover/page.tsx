import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import DiscoverPageClient from "./discover-client";

export async function generateMetadata(
  props: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const base = buildPageMetadata({
    title: "Discover Surfers - Find Surf Buddies",
    description:
      "Find and follow surfers in your community. Search for surf buddies, connect with local surfers, and build your crew. Sign in to discover surfers near you and coordinate surf sessions.",
    path: "/discover",
    keywords: [
      "find surf buddies",
      "surf community",
      "connect with surfers",
      "follow surfers",
      "surf friends",
      "local surfers",
    ],
  });

  const hasAnyQueryParam = (() => {
    if (!searchParams) return false;
    return Object.values(searchParams).some((value) => {
      if (typeof value === "string") return value.length > 0;
      if (Array.isArray(value))
        return value.some((v) => typeof v === "string" && v.length > 0);
      return false;
    });
  })();

  if (!hasAnyQueryParam) return base;

  return {
    ...base,
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
  };
}

export default function DiscoverPage() {
  return <DiscoverPageClient />;
}
