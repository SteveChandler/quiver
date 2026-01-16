'use client';

import { cn } from '@/lib/utils';
import type { TimeSlot } from '@/types/personalization';

interface TimeSlotSelectorProps {
  value: TimeSlot;
  onChange: (slot: TimeSlot) => void;
  className?: string;
}

const TIME_SLOT_OPTIONS: { value: TimeSlot; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'dawn-patrol', label: 'Dawn patrol' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
];

export function TimeSlotSelector({ value, onChange, className }: TimeSlotSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Time slot filter" className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
      {TIME_SLOT_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
            'min-h-[44px] flex items-center justify-center',
            value === option.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
