"use client";

import type { ReactNode } from "react";
import type { Beach } from "@/types/database";
import type { BeachSources } from "@/hooks/use-beach-detail-data";
import type { ZineBeachPhoto } from "./types";
import { RoughEdgeFilter } from "./atoms";
import { ZineHero } from "./zine-hero";
import { ZineFooter } from "./zine-footer";

interface ZinePageShellProps {
  beach: Beach;
  beachPhoto?: ZineBeachPhoto | null;
  sources?: BeachSources | null;
  /**
   * The tabs container is rendered here so the cream-paper styling wraps
   * the tabs row and tab content. Sits between the hero and the footer.
   */
  children: ReactNode;
}

/**
 * Outer page shell for the zine: masthead, hero, then the tabs/children,
 * then the footer. This component is the top-level cream-paper container
 * that replaces the dark twilight chrome on the beach detail page.
 */
export function ZinePageShell({ beach, beachPhoto, sources, children }: ZinePageShellProps) {
  return (
    <div className="zine-page zine-tab">
      <RoughEdgeFilter />
      <div className="zine-stage">
        <div className="zine-masthead">
          <div className="left">
            <span>Field Guide · Vol. 03</span>
            <span className="rule" aria-hidden />
            <span>
              {beach.city
                ? `${beach.city.toUpperCase()}${beach.state ? `, ${beach.state.toUpperCase()}` : ""}`
                : "FIELD"}
            </span>
          </div>
          <div>
            {new Date()
              .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              .toUpperCase()}
          </div>
        </div>

        <div className="zine-paper">
          <ZineHero beach={beach} beachPhoto={beachPhoto} sources={sources} />

          {/* Integrated tabs row + per-tab content lives inside the cream paper */}
          <div className="zine-tabs-slot mt-7">
            {children}
          </div>

          <ZineFooter city={beach.city} state={beach.state} />
        </div>
      </div>
    </div>
  );
}
