import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import AboutPageClient from "./about-client";

// ISR: Revalidate every 1 hour (static content, rarely changes)
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "About - The Surf Community Story | Our Mission",
  description:
    "Learn about Quiver's mission to connect surfers worldwide. Built by surfers, for surfers. Track sessions, find buddies, and share the stoke. Our story, values, and vision for the future of surf community.",
  path: "/about",
  keywords: [
    "about Quiver",
    "surf community mission",
    "surf app story",
    "surfer community",
    "connect surfers",
    "surf social platform",
  ],
});

export default function AboutPage() {
  return <AboutPageClient />;
}
