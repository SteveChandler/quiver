"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

interface SonarPingProps {
  size?: number;
  color?: string;
  className?: string;
  "aria-hidden"?: boolean;
}

/**
 * Three nested rings, radiating outward. Used behind the "I'm in"
 * stamp button and any "someone just dropped" hero.
 *
 * Respects prefers-reduced-motion — collapses to a single static ring.
 */
export function SonarPing({
  size = 96,
  color = "var(--q-orange)",
  className,
  "aria-hidden": ariaHidden = true,
}: SonarPingProps) {
  const reducedMotion = useReducedMotion();
  const dimension = `${size}px`;

  return (
    <div
      aria-hidden={ariaHidden}
      className={cn(
        "sonar-ping pointer-events-none relative",
        reducedMotion && "sonar-ping--reduced",
        className,
      )}
      data-testid="sonar-ping"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      style={
        {
          width: dimension,
          height: dimension,
          "--sonar-color": color,
        } as React.CSSProperties
      }
    >
      <span className="sonar-ping__ring" style={{ animationDelay: "0s" }} />
      <span className="sonar-ping__ring" style={{ animationDelay: "0.8s" }} />
      <span className="sonar-ping__ring" style={{ animationDelay: "1.6s" }} />
    </div>
  );
}
