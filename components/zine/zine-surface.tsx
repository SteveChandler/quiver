import type { ReactNode } from "react";

import { RoughEdgeFilter } from "@/components/beach-detail/zine/atoms";
import { cn } from "@/lib/utils";

export interface ZineSurfaceProps {
  sectionLabel: string;
  editionLabel?: string;
  children: ReactNode;
  id?: string;
  className?: string;
  stageClassName?: string;
  paperClassName?: string;
  showMasthead?: boolean;
  "data-testid"?: string;
}

export function ZineSurface({
  sectionLabel,
  editionLabel = "Quiver field guide",
  children,
  id,
  className,
  stageClassName,
  paperClassName,
  // Off by default: the app header already sits directly above every zine
  // surface with the Quiver wordmark in it, so a masthead renders as a second
  // header repeating the brand mark. Stacked-section pages got two or three of
  // them. Opt back in per-surface if a page ever needs an editorial masthead.
  showMasthead = false,
  "data-testid": dataTestId = "zine-surface",
}: ZineSurfaceProps) {
  return (
    <div
      id={id}
      className={cn("zine-page zine-tab", className)}
      data-testid={dataTestId}
    >
      <RoughEdgeFilter />
      <div className={cn("zine-stage", stageClassName)}>
        {showMasthead ? (
          <div className="zine-masthead">
            <div className="left">
              <span className="logo">Quiver</span>
              <span className="rule" aria-hidden />
              <span>{sectionLabel}</span>
            </div>
            <div>{editionLabel}</div>
          </div>
        ) : null}

        <div className={cn("zine-paper", paperClassName)}>{children}</div>
      </div>
    </div>
  );
}
