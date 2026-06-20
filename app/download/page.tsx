import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactElement } from "react";

import { DownloadView } from "@/components/download/download-view";
import { getFirstTouchPlatform } from "@/lib/analytics/web-context";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Download Quiver | Surf Forecast App for iPhone & Android",
  description:
    "Download Quiver for honest surf forecasts, board-aware picks, and one-tap session logging. Free on iPhone, with Android beta access open.",
  alternates: { canonical: "/download" },
  openGraph: {
    title: "Download Quiver",
    description:
      "Honest surf forecasts, board-aware picks, and session logging. Free on iPhone, with Android beta access open.",
    url: "/download",
    siteName: "Quiver",
    type: "website",
    images: [
      {
        url: "/images/hero/quiver-landing-hero-social.jpg",
        width: 1200,
        height: 630,
        alt: "Download the Quiver surf forecast app",
      },
    ],
  },
};

export default async function DownloadPage(): Promise<ReactElement> {
  const ua = (await headers()).get("user-agent") ?? "";
  const platform = getFirstTouchPlatform(ua);

  return <DownloadView platform={platform} />;
}
