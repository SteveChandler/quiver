import type { Metadata } from "next";
import type { ReactElement } from "react";

import { OutsideGame } from "@/components/play/OutsideGame";
import { ZineSurface } from "@/components/zine/zine-surface";
import { dailySeed } from "@/lib/play";
import { buildPageMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildPageMetadata({
  title: "OUTSIDE — A Surf Game by Quiver",
  description:
    "Sets are coming. Get to the peak in OUTSIDE, Quiver's daily browser surf game. Same set, same waves — send your heat to a friend.",
  path: "/play",
  keywords: [
    "surf game",
    "browser surf game",
    "daily surf game",
    "Quiver OUTSIDE",
  ],
});

interface PlayPageProps {
  searchParams: Promise<{ c?: string | string[] }>;
}

export default async function PlayPage({ searchParams }: PlayPageProps): Promise<ReactElement> {
  const params = await searchParams;
  const challengeCode = typeof params.c === "string" ? params.c : undefined;

  return (
    <ZineSurface
      sectionLabel="OUTSIDE"
      editionLabel="Daily heat"
      className="min-h-screen bg-[#0D1020]"
      stageClassName="min-h-screen pt-20"
      paperClassName="overflow-hidden !p-2 sm:!p-4"
      data-testid="outside-game-page"
    >
      <h1 className="sr-only">OUTSIDE — Sets are coming. Get to the peak.</h1>
      <OutsideGame challengeCode={challengeCode} todaySeed={dailySeed()} />
    </ZineSurface>
  );
}
