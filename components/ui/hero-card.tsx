import { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface HeroCardProps extends HTMLAttributes<HTMLElement> {
  /** Tailwind gradient classes, e.g. "from-white/80 to-blue-50/60" */
  gradient?: string;
  /** Tailwind border color class, e.g. "border-blue-200/50" */
  borderColor?: string;
  /** Attribution text rendered in the footer */
  attribution?: string;
  /** Tailwind border color for the attribution separator, e.g. "border-blue-100/50" */
  attributionBorderColor?: string;
  children: ReactNode;
}

/**
 * HeroCard - Shared card shell for intent hero sections.
 *
 * Provides the common gradient + border + attribution footer pattern
 * used across TideHeroSection, WaterTempHeroSection, SunTimesHeroSection,
 * and any future intent hero sections. Each section configures its own
 * color theme via props and supplies its content as children.
 *
 * Extends HTMLAttributes<HTMLElement> so callers can pass aria-label,
 * data-testid, and other HTML attributes directly.
 */
export function HeroCard({
  gradient = "from-white/80 to-blue-50/60",
  borderColor = "border-blue-200/50",
  attribution,
  attributionBorderColor = "border-blue-100/50",
  children,
  className,
  ...rest
}: HeroCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl backdrop-blur-sm bg-gradient-to-br shadow-lg p-6 md:p-8",
        gradient,
        borderColor,
        "border",
        className
      )}
      {...rest}
    >
      {children}

      {attribution && (
        <p
          className={cn(
            "text-xs text-gray-500 mt-4 pt-3 border-t",
            attributionBorderColor
          )}
        >
          {attribution}
        </p>
      )}
    </section>
  );
}
