import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import AboutPageClient from "./about-client";

// ISR: Revalidate every 1 hour (static content, rarely changes)
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "About Quiver — Why I Built This",
  description:
    "I was tired of checking five apps before every session and showing up to conditions that didn't match. So I built Quiver — real surf data from real sources, for surfers who want to make the call.",
  path: "/about",
  keywords: [
    "about Quiver",
    "surf forecast app",
    "surf data",
    "surf conditions",
    "real surf data",
  ],
});

export default function AboutPage() {
  return <AboutPageClient />;
}
