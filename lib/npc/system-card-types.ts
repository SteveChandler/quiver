export const SYSTEM_CARD_CLASSES = [
  "forecast_summary",
  "wind_read",
  "water_temperature",
  "prompt",
  "correction_request",
  "forecast_vs_observation",
] as const;

export type SystemCardClass = (typeof SYSTEM_CARD_CLASSES)[number];

export const PROMPT_CARD_CLASSES = new Set<SystemCardClass>([
  "prompt",
  "correction_request",
  "forecast_vs_observation",
]);

export function isPromptCardClass(contentClass: SystemCardClass): boolean {
  return PROMPT_CARD_CLASSES.has(contentClass);
}

/** Deterministic ten-card cadence: three response-shaped cards per ten. */
export function planSystemCardClasses(
  count: number,
  offset = 0,
): SystemCardClass[] {
  const planned: SystemCardClass[] = [];
  const nonPrompt: SystemCardClass[] = [
    "forecast_summary",
    "wind_read",
    "water_temperature",
  ];
  const prompt: SystemCardClass[] = [
    "prompt",
    "correction_request",
    "forecast_vs_observation",
  ];

  for (let index = 0; index < Math.max(0, count); index += 1) {
    const sequence = offset + index;
    if (sequence % 10 < 3) {
      planned.push(prompt[sequence % prompt.length]);
      continue;
    }
    planned.push(nonPrompt[sequence % nonPrompt.length]);
  }
  return planned;
}
