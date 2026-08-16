import {
  isPersonaPostingEnabled,
  areSystemCardsEnabled,
  isLegacyMorningForecastEnabled,
} from "@/lib/npc/system-card-config";

describe("system-card rollout flags", () => {
  it("keeps all automated publishers opt-in and rejects empty or typo flags", () => {
    expect(isPersonaPostingEnabled({})).toBe(false);
    expect(isPersonaPostingEnabled({ NPC_PERSONA_POSTING_ENABLED: "true" })).toBe(true);
    expect(isLegacyMorningForecastEnabled({})).toBe(false);
    expect(isLegacyMorningForecastEnabled({ QUIVER_LEGACY_MORNING_FORECAST_ENABLED: "true" })).toBe(true);
    expect(areSystemCardsEnabled({})).toBe(false);
    expect(areSystemCardsEnabled({ QUIVER_SYSTEM_CARDS_ENABLED: "" })).toBe(false);
    expect(areSystemCardsEnabled({ QUIVER_SYSTEM_CARDS_ENABLED: "TRUE" })).toBe(false);
    expect(areSystemCardsEnabled({ QUIVER_SYSTEM_CARDS_ENABLED: "true" })).toBe(true);
  });
});
