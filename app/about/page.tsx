import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import AboutPageClient from "./about-client";

export const metadata: Metadata = buildPageMetadata({
  title: "About Quiver - The Surf Community Story | Our Mission",
  description:
    "Learn about Quiver's mission to connect surfers worldwide. Built by surfers, for surfers. Join 1,200+ surfers tracking sessions, finding buddies, and sharing the stoke. Our story, values, and vision for the future of surf community.",
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
