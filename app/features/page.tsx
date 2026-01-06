import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import FeaturesPageClient from "./features-client";

export const metadata: Metadata = buildPageMetadata({
  title: "Features - Surf Tracking, Forecasts & Community",
  description:
    "Discover Quiver's powerful features: track surf sessions, get accurate forecasts, find surf buddies, share photos, and connect with the surf community. Free surf app for iOS, Android, and web.",
  path: "/features",
  keywords: [
    "surf app features",
    "surf tracking app",
    "surf forecast app",
    "surf community features",
    "track surf sessions",
    "surf social network",
    "surf journal features",
  ],
});

export default function FeaturesPage() {
  return <FeaturesPageClient />;
}
