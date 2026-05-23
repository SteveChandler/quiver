import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { AppleBetaPromptDeviceMode } from "@/lib/app-store/apple-beta-prompt";
import { AppleBetaPromptHarness } from "./prompt-harness";

interface AppleBetaPromptE2EPageProps {
  searchParams?: Promise<{
    mode?: string | string[];
  }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apple Beta Prompt E2E",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AppleBetaPromptE2EPage({
  searchParams,
}: AppleBetaPromptE2EPageProps) {
  if (process.env.VERCEL_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const rawMode = Array.isArray(params?.mode) ? params?.mode[0] : params?.mode;
  const deviceMode: AppleBetaPromptDeviceMode =
    rawMode === "ios" ? "ios_direct" : "desktop_qr";

  return <AppleBetaPromptHarness deviceMode={deviceMode} />;
}
