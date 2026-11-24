import { travelArrowRotation } from "@/lib/buoy-pages/format";
import { cn } from "@/lib/utils";

interface DirectionArrowProps {
  /** Direction the waves or wind come FROM, degrees true. */
  fromDegrees: number;
  className?: string;
}

/** Arrow pointing the way the energy travels; the label beside it says where it comes from. */
export function DirectionArrow({ fromDegrees, className }: DirectionArrowProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("inline-block h-5 w-5 shrink-0", className)}
      aria-hidden
      style={{ transform: `rotate(${travelArrowRotation(fromDegrees)}deg)` }}
    >
      <path d="M12 3 L18 15 L12 12 L6 15 Z" fill="currentColor" />
      <line x1="12" y1="12" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
