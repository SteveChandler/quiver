/**
 * Scope rules for the friction gates in `weekly-signup-intel.ts`.
 * Kept apart from the script so the rules can be tested without a database.
 */

export type GateScopeRule = {
  /** Metadata key that names the surface, e.g. `source`. */
  key: string;
  /** Values of that key that the gate does not measure. */
  values: string[];
  /** Plain name of the excluded surfaces, shown in the report. */
  label: string;
};

export type GateEventScope = "counted" | "out-of-scope" | "dev-build";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Emulator and development-channel builds are our own test traffic, not users. */
export function isDevBuildEvent(event: { metadata: unknown }): boolean {
  const meta = asRecord(event.metadata);
  return meta.is_emulator === true || meta.expo_channel === "development";
}

/**
 * Decide whether an event belongs in a gate's numerator or denominator.
 * The same rule applies to both, so a ratio never mixes two populations.
 */
export function classifyGateEvent(
  event: { metadata: unknown },
  outOfScope?: GateScopeRule
): GateEventScope {
  if (isDevBuildEvent(event)) return "dev-build";
  if (!outOfScope) return "counted";
  const value = asRecord(event.metadata)[outOfScope.key];
  return typeof value === "string" && outOfScope.values.includes(value) ? "out-of-scope" : "counted";
}
