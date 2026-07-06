"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { FigureKey } from "./figure-keys";
import { FigurePoster } from "./figure-poster";

const FIGURES: Record<FigureKey, ComponentType> = {
  "swell-period-morph": dynamic(() => import("./swell-period-morph"), {
    ssr: false,
    loading: () => <FigurePoster kind="period-morph" />,
  }),
  "swell-origin-fetch": dynamic(() => import("./swell-origin-fetch"), {
    ssr: false,
    loading: () => <FigurePoster kind="origin-fetch" />,
  }),
};

export function LearnFigure({ figureKey }: { figureKey: FigureKey }) {
  const Figure = FIGURES[figureKey];
  if (!Figure) {
    if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
      console.warn(`[LearnFigure] unknown figureKey: ${figureKey}`);
    }
    return null;
  }
  return <Figure />;
}
