import type { EnhancedForecastEntity } from "@/types/forecast";
import type { CanonicalSessionDecision } from "@/lib/recommendations/canonical-decision/types";

export type HomeMorningCallPresentation = {
  title: string;
  body: string;
  label: "Worth it" | "Maybe" | "Skip";
};

export function normalizeForecastPeriod(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const numeric = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)/)?.[1];
  if (!numeric) return null;
  return `${numeric}s`;
}

function conditionLine(forecast: EnhancedForecastEntity): string | null {
  const height = forecast.wave_height?.trim();
  if (!height) return null;
  const period = normalizeForecastPeriod(forecast.wave_period);
  return period ? `${height} @ ${period}` : height;
}

export function buildHomeMorningCallPresentation(
  decision: CanonicalSessionDecision,
  beachName: string,
  forecast: EnhancedForecastEntity | null,
): HomeMorningCallPresentation {
  const label = decision.verdict === "go"
    ? "Worth it"
    : decision.verdict === "maybe"
      ? "Maybe"
      : "Skip";
  const titleLabel = decision.verdict === "go"
    ? "It's firing"
    : decision.verdict === "maybe"
      ? "Worth a look"
      : "Rest up today";
  const condition = forecast ? conditionLine(forecast) : null;
  const caution = (decision.effects ?? [])
    .filter((effect) => effect.severity !== "informational")
    .map((effect) => effect.message)[0] ?? null;
  const body = decision.verdict === "no"
    ? caution ?? "Conditions do not support a surf call today."
    : [condition, caution].filter(Boolean).join(". ") ||
      (decision.verdict === "go" ? "Conditions line up today." : "There may be a window today.");
  return {
    title: `${beachName}: ${titleLabel}`,
    body: body.endsWith(".") ? body : `${body}.`,
    label,
  };
}
