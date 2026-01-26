import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import FeaturesPageClient from "./features-client";

export const metadata: Metadata = buildPageMetadata({
  title: "Features - AI Surf Forecasts, Personalized Recommendations & Community",
  description:
    "Quiver uses machine learning to correct NOAA wave models with real-time buoy data, delivering personalized surf forecasts with 0-100 match scores. Free for iOS, Android, and web.",
  path: "/features",
  keywords: [
    "ai surf forecast",
    "personalized surf recommendations",
    "ml wave prediction",
    "real-time buoy data",
    "surf forecast accuracy",
    "surf session tracking",
    "ios surf app",
    "android surf app",
  ],
});

export default function FeaturesPage() {
  return <FeaturesPageClient />;
}
