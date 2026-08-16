'use client';

import { cn } from '@/lib/utils';
import { Wind } from 'lucide-react';

const CARDINAL_DIRECTIONS = [
  { degrees: 0, label: 'N', name: 'North', position: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' },
  { degrees: 45, label: 'NE', name: 'Northeast', position: 'top-0 right-0 translate-x-1/2 -translate-y-1/2' },
  { degrees: 90, label: 'E', name: 'East', position: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2' },
  { degrees: 135, label: 'SE', name: 'Southeast', position: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2' },
  { degrees: 180, label: 'S', name: 'South', position: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' },
  { degrees: 225, label: 'SW', name: 'Southwest', position: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2' },
  { degrees: 270, label: 'W', name: 'West', position: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2' },
  { degrees: 315, label: 'NW', name: 'Northwest', position: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2' },
] as const;

export interface WindDirectionCompassProps {
  /**
   * Array of selected wind directions in degrees (0-360)
   * e.g., [0, 90, 180] for North, East, South
   */
  value: number[];
  /**
   * Callback when the selection changes
   */
  onChange: (directions: number[]) => void;
  /**
   * Whether the compass is disabled
   */
  disabled?: boolean;
  /**
   * Additional CSS classes for the container
   */
  className?: string;
}

/**
 * WindDirectionCompass - 8-way compass selector for preferred wind directions
 *
 * Features:
 * - 8 cardinal/intercardinal directions (N, NE, E, SE, S, SW, W, NW)
 * - Multi-select capability
 * - Touch-friendly (44x44px minimum)
 * - Accessible (keyboard navigation, ARIA labels)
 * - Visual feedback for selected state
 *
 * @example
 * ```tsx
 * const [directions, setDirections] = useState<number[]>([0, 90]);
 * <WindDirectionCompass value={directions} onChange={setDirections} />
 * ```
 */
export function WindDirectionCompass({
  value = [],
  onChange,
  disabled = false,
  className,
}: WindDirectionCompassProps) {
  const handleToggle = (degrees: number) => {
    if (disabled) return;

    const isSelected = value.includes(degrees);
    const updated = isSelected
      ? value.filter((d) => d !== degrees).sort((a, b) => a - b) // Sort after removal too
      : [...value, degrees].sort((a, b) => a - b); // Keep sorted for consistency

    onChange(updated);
  };

  return (
    <div className={cn('w-full max-w-sm mx-auto', className)}>
      {/* Compass Container */}
      <div className="relative w-64 h-64 mx-auto">
        {/* Center Circle with Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-gray-50 border-2 border-gray-200 flex items-center justify-center">
            <Wind className="w-12 h-12 text-gray-400" aria-hidden="true" />
          </div>
        </div>

        {/* Cardinal Direction Buttons */}
        {CARDINAL_DIRECTIONS.map((direction) => {
          const isSelected = value.includes(direction.degrees);

          return (
            <button
              key={direction.degrees}
              type="button"
              onClick={() => handleToggle(direction.degrees)}
              disabled={disabled}
              aria-label={`${direction.name} (${direction.degrees}°)`}
              aria-pressed={isSelected}
              className={cn(
                // Position
                'absolute',
                direction.position,
                // Size (44x44px minimum for touch)
                'w-14 h-14',
                // Shape
                'rounded-full',
                // Border & Background
                'border-2 transition-[color,background-color,border-color,box-shadow] duration-200',
                isSelected
                  ? 'border-ocean-blue bg-ocean-blue text-white shadow-md'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-ocean-blue hover:bg-blue-50',
                // Disabled state
                disabled && 'opacity-50 cursor-not-allowed',
                // Focus styles
                'focus:outline-none focus:ring-2 focus:ring-ocean-blue focus:ring-offset-2'
              )}
            >
              <span className="font-semibold text-sm">{direction.label}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Directions Display */}
      {value.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-600" aria-live="polite">
          Selected: {value.map((deg) => {
            const direction = CARDINAL_DIRECTIONS.find((d) => d.degrees === deg);
            return direction?.label;
          }).join(', ')}
        </div>
      )}
    </div>
  );
}
