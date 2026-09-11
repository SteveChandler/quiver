import type { Metadata } from "next";
import type { ReactElement } from "react";

import { OutsideGame } from "@/components/play/OutsideGame";
import { dailySeed } from "@/lib/play";
import { buildPageMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildPageMetadata({
  title: "ONE MORE WAVE — A Surf Game by Quiver",
  description:
    "Ride the line, beat the pier, and challenge a friend in ONE MORE WAVE, Quiver's daily browser surf game.",
  path: "/play",
  keywords: [
    "surf game",
    "browser surf game",
    "daily surf game",
    "Quiver ONE MORE WAVE",
  ],
});

interface PlayPageProps {
  searchParams: Promise<{ c?: string | string[] }>;
}

export default async function PlayPage({ searchParams }: PlayPageProps): Promise<ReactElement> {
  const params = await searchParams;
  const challengeCode = typeof params.c === "string" ? params.c : undefined;

  return (
    <div className="h-svh overflow-hidden bg-[#0B5FA5]" data-testid="outside-game-page">
      <h1 className="sr-only">ONE MORE WAVE — Ride the line. Beat the pier. Get the real one.</h1>
      <OutsideGame challengeCode={challengeCode} todaySeed={dailySeed()} />
    </div>
  );
}
