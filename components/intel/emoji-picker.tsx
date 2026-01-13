"use client";

import { cn } from "@/lib/utils";
import type { IntelEmojiRating } from "@/types/database";

interface EmojiPickerProps {
  value?: IntelEmojiRating | null;
  onChange: (rating: IntelEmojiRating) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

const EMOJI_OPTIONS: { value: IntelEmojiRating; emoji: string; label: string }[] = [
  { value: "fire", emoji: "\u{1F525}", label: "Fire" },
  { value: "shaka", emoji: "\u{1F919}", label: "Shaka" },
  { value: "meh", emoji: "\u{1F610}", label: "Meh" },
  { value: "thumbsdown", emoji: "\u{1F44E}", label: "Nah" },
];

const SIZE_CLASSES = {
  sm: "text-xl p-2 min-w-[44px]",
  md: "text-2xl p-3 min-w-[56px]",
  lg: "text-3xl p-4 min-w-[68px]",
};

/**
 * EmojiPicker - Select a condition rating using emojis
 *
 * @example
 * ```tsx
 * <EmojiPicker value={rating} onChange={setRating} />
 * ```
 */
export function EmojiPicker({
  value,
  onChange,
  disabled = false,
  size = "md"
}: EmojiPickerProps) {
  return (
    <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="Condition rating">
      {EMOJI_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.label}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-xl transition-all duration-200",
            "hover:bg-white/10 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            SIZE_CLASSES[size],
            value === option.value
              ? "bg-white/20 ring-2 ring-white/40 scale-110"
              : "bg-white/5",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="block">{option.emoji}</span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Display an emoji rating (read-only)
 */
export function EmojiRatingDisplay({ rating, size = "sm" }: { rating: IntelEmojiRating; size?: "sm" | "md" }) {
  const option = EMOJI_OPTIONS.find((o) => o.value === rating);
  if (!option) return null;

  return (
    <span
      className={cn("inline-block", size === "sm" ? "text-lg" : "text-xl")}
      title={option.label}
    >
      {option.emoji}
    </span>
  );
}

export { EMOJI_OPTIONS };
export default EmojiPicker;
