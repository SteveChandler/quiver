import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import DiscoverPageClient from "./discover-client";

export const metadata: Metadata = buildPageMetadata({
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

export default function DiscoverPage() {
  return <DiscoverPageClient />;
}
