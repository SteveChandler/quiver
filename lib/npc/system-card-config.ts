export const PERSONA_POSTING_FLAG = "NPC_PERSONA_POSTING_ENABLED";
export const SYSTEM_CARDS_FLAG = "QUIVER_SYSTEM_CARDS_ENABLED";
export const LEGACY_MORNING_FORECAST_FLAG = "QUIVER_LEGACY_MORNING_FORECAST_ENABLED";

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

/** Persona accounts remain intact; this flag is the only re-enable switch. */
export function isPersonaPostingEnabled(
  env: RuntimeEnvironment = process.env,
): boolean {
  return env[PERSONA_POSTING_FLAG] === "true";
}

export function areSystemCardsEnabled(
  env: RuntimeEnvironment = process.env,
): boolean {
  return env[SYSTEM_CARDS_FLAG] === "true";
}

export function isLegacyMorningForecastEnabled(
  env: RuntimeEnvironment = process.env,
): boolean {
  return env[LEGACY_MORNING_FORECAST_FLAG] === "true";
}

export const SYSTEM_VOICE_LABEL = "Quiver Forecast";
export const TARGET_SYSTEM_CARDS_PER_DAY = 10;
export const MAX_SYSTEM_CARDS_PER_DAY = 12;
export const MAX_SYSTEM_CARDS_PER_BEACH_PER_DAY = 2;
export const MAX_SYSTEM_CARD_SHARE_7D = 0.1;
export const SYSTEM_CARD_DEDUPE_DAYS = 14;
export const SYSTEM_CARD_SEMANTIC_DEDUPE_DAYS = 7;
