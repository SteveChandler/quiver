"use client";

import type { ReactNode } from "react";

import { RoughEdgeFilter } from "@/components/beach-detail/zine/atoms";

interface HomeZineShellProps {
  children: ReactNode;
}

/**
 * Page shell for the signed-in home screen.
 *
 * Every state of the home screen — cold load, recheck, empty, and the fully
 * resolved call — renders through this one shell. That is deliberate: the
 * screen used to swap between a full-bleed navy skeleton, a navy empty card,
 * and the real page, so each transition wiped the layout and read as a broken
 * load. Keeping one cream-paper page under all four states means a state
 * change swaps the contents of the page rather than the page itself.
 *
 * Cream paper on a twilight stage is the canonical Quiver surface
 * (`app/styles/zine.css`, Brand-Vault DESIGN_SYSTEM.md). The twilight is
 * backdrop only; content belongs on paper.
 *
 * No zine masthead here. The app header already sits directly above this
 * screen with the Quiver wordmark in it, so a masthead reads as a second
 * header and repeats the brand mark. What the masthead carried is not lost:
 * the beach and its distance from home are the plate's eyebrow, and the town
 * is part of the beach identity there.
 */
export function HomeZineShell({ children }: HomeZineShellProps) {
  return (
    <div className="zine-page zine-tab min-h-screen">
      <RoughEdgeFilter />
      <div className="zine-stage min-h-screen">
        <div className="zine-paper">{children}</div>
      </div>
    </div>
  );
}
