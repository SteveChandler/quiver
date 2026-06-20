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
  showMasthead = true,
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
