/**
 * Forecast Section Container - DRY wrapper for forecast section layouts
 *
 * Standard container with py-10 px-4 padding and max-w-3xl centered content.
 * Used consistently across forecast and landing page components.
 *
 * @module components/forecast/forecast-section-container
 */

import { cn } from "@/lib/utils";

interface ForecastSectionContainerProps {
  children: React.ReactNode;
  testId?: string;
  className?: string;
}

export function ForecastSectionContainer({
  children,
  testId,
  className,
}: ForecastSectionContainerProps) {
  return (
    <section className={cn("py-10 px-4", className)} data-testid={testId}>
      <div className="max-w-3xl mx-auto">{children}</div>
    </section>
  );
}
