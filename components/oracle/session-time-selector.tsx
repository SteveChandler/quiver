"use client";

export interface SessionTimeSelectorProps {
  onSelect: (time: string) => void;
  currentValue?: string | null;
}

interface TimeOption {
  value: string;
  emoji: string;
  label: string;
  range: string;
}

const TIME_OPTIONS: TimeOption[] = [
  { value: "dawn_patrol", emoji: "🌅", label: "Dawn Patrol", range: "4–7am" },
  { value: "morning", emoji: "☀️", label: "Morning", range: "7–10am" },
  { value: "lunch", emoji: "🌤️", label: "Lunch", range: "10am–1pm" },
  { value: "afternoon", emoji: "🏄", label: "Afternoon", range: "1–5pm" },
  { value: "evening", emoji: "🌇", label: "Evening", range: "5–8pm" },
  { value: "any", emoji: "⏰", label: "Any time", range: "Flexible" },
];

export function SessionTimeSelector({
  onSelect,
  currentValue,
}: SessionTimeSelectorProps) {
  return (
    <div>
      <p className="font-heading mb-4 text-center text-base font-semibold text-white">
        When do you usually paddle out?
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TIME_OPTIONS.map((option) => {
          const isSelected = currentValue === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={[
                "rounded-xl border p-3 text-center transition-colors",
                isSelected
                  ? "border-[#FDB84B] bg-[#FDB84B]/10"
                  : "border-[#404C92] bg-[#2D357D] hover:border-[#FDB84B]/40",
              ].join(" ") + " focus-ring"}
            >
              <div className="mb-1 text-xl leading-none">{option.emoji}</div>
              <div className="font-heading text-high text-sm font-medium">
                {option.label}
              </div>
              <div className="text-medium text-xs">{option.range}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
