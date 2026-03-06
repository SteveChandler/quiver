'use client';

import { motion } from 'framer-motion';
import { Clock, Sunrise, Sun, SunDim } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { HOME_HEADER_MOTION } from '@/lib/constants/animations';
import type { TimeSlot } from '@/types/personalization';

interface TimeSlotSelectorProps {
  value: TimeSlot;
  onChange: (slot: TimeSlot) => void;
  className?: string;
}

const TIME_SLOT_OPTIONS: { value: TimeSlot; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'any', label: 'Any time', icon: Clock },
  { value: 'dawn-patrol', label: 'Dawn patrol', icon: Sunrise },
  { value: 'lunch-session', label: 'Lunch session', icon: Sun },
  { value: 'afternoon', label: 'Afternoon', icon: SunDim },
];

export function TimeSlotSelector({ value, onChange, className }: TimeSlotSelectorProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label="Time slot filter"
      className={cn(
        'flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6',
        'scrollbar-hide',
        className
      )}
      data-testid="time-slot-selector"
    >
      {TIME_SLOT_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;

        return (
          <motion.button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            whileTap={reducedMotion ? undefined : HOME_HEADER_MOTION.timeSlot.tap}
            animate={
              isSelected && !reducedMotion
                ? HOME_HEADER_MOTION.timeSlot.selected
                : { scale: 1 }
            }
            transition={reducedMotion ? { duration: 0 } : { type: "spring", ...HOME_HEADER_MOTION.timeSlot.spring }}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0',
              'min-h-[44px] flex items-center justify-center gap-1.5',
              'transition-colors duration-200',
              isSelected
                ? 'bg-primary text-primary-foreground shadow-[0_0_0_3px_rgba(59,130,246,0.3)]'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </motion.button>
        );
      })}
    </div>
  );
}
