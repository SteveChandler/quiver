import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactElement } from "react";

import { buildPageMetadata } from "@/lib/seo/meta";
import { parseUserAgent } from "@/lib/utils/user-agent-parser";

import {
  PbscWelcomeClient,
  type PbscVisitorPlatform,
} from "./pbsc-welcome-client";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Get the Quiver Surf App | Welcome",
    description:
      "You found the flyer. Get the surf app that matches today's forecast against the sessions you loved.",
    path: "/pbsc",
    keywords: [
      "Quiver app",
      "surf forecast app",
      "surf session log",
      "surf app",
    ],
  }),
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

function platformFromUserAgent(userAgent: string): PbscVisitorPlatform {
  const os = parseUserAgent(userAgent).os;

  if (os === "iOS") return "ios";
  if (os === "Android") return "android";

  return "unknown";
}

export default async function PbscPage(): Promise<ReactElement> {
  const userAgent = (await headers()).get("user-agent") ?? "";

  return <PbscWelcomeClient platform={platformFromUserAgent(userAgent)} />;
}
