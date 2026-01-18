'use client';

import { Clock, Sunrise, Sun, SunDim } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimeSlot } from '@/types/personalization';

interface TimeSlotSelectorProps {
  value: TimeSlot;
  onChange: (slot: TimeSlot) => void;
  className?: string;
}

const TIME_SLOT_OPTIONS: { value: TimeSlot; label: string; icon: React.ElementType }[] = [
  { value: 'any', label: 'Any time', icon: Clock },
  { value: 'dawn-patrol', label: 'Dawn patrol', icon: Sunrise },
  { value: 'morning', label: 'Morning', icon: Sun },
  { value: 'afternoon', label: 'Afternoon', icon: SunDim },
];

export function TimeSlotSelector({ value, onChange, className }: TimeSlotSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Time slot filter" className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
      {TIME_SLOT_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              'min-h-[44px] flex items-center justify-center gap-1.5',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
