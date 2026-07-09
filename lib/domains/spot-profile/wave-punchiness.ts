import type { Database } from '@/types/database.generated';

type BeachPersona = Database['public']['Enums']['beach_persona'];

const PERSONA_PUNCHINESS: Record<BeachPersona, number> = {
  canyon_amplified: 0.6,
  exposed_beach_break: 0.3,
  jetty_harbor: 0,
  sheltered_reef: -0.2,
  point_break: -0.4,
};

// Keys match the actual beaches.break_type vocabulary (hyphenated), which is
// beach / reef / point / jetty / pier / river-mouth / breakwater / inlet.
// Legacy space/underscore forms are kept for any un-normalized rows.
const BREAK_TYPE_PUNCHINESS: Record<string, number> = {
  reef: 0.3, // steep takeoff over rock/coral
  point: -0.3, // long peeling walls, log-friendly
  beach: 0, // variable sandbar
  'river-mouth': 0.2, // sandbar wedge, can get hollow
  jetty: 0.1, // jetty-sculpted wedge, mildly punchy/variable
  pier: 0, // beach-break-like sandbars around pilings
  breakwater: -0.1, // artificial, sheltered, softer
  inlet: 0.1, // tidal-inlet sandbar, river-mouth-like
  // legacy / alternate forms
  'reef break': 0.3,
  'point break': -0.3,
  'beach break': 0,
  river_mouth: 0.2,
  'river mouth': 0.2,
};

const SKILL_SHIFT: Record<string, number> = {
  beginner: -0.3,
  intermediate: 0,
  advanced: 0.2,
  expert: 0.4,
};

export interface WavePunchinessInputs {
  persona?: string | null;
  break_type?: string | null;
  skill_level?: string | null;
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function deriveWavePunchiness(
  inputs: WavePunchinessInputs
): number | null {
  const persona = inputs.persona?.toLowerCase() ?? null;
  const breakType = inputs.break_type?.toLowerCase() ?? null;
  const skill = inputs.skill_level?.toLowerCase() ?? null;

  const personaBase =
    persona && persona in PERSONA_PUNCHINESS
      ? PERSONA_PUNCHINESS[persona as BeachPersona]
      : undefined;
  const breakBase =
    breakType && breakType in BREAK_TYPE_PUNCHINESS
      ? BREAK_TYPE_PUNCHINESS[breakType]
      : undefined;

  const base = personaBase ?? breakBase;
  const shift = skill ? SKILL_SHIFT[skill] : undefined;

  if (base === undefined && shift === undefined) return null;

  return clampUnit((base ?? 0) + (shift ?? 0));
}

/**
 * Confidence floor below which an LLM-derived punchiness is treated as too weak
 * to trust — the resolver falls back to the structural derivation instead. This
 * keeps the aggressive board-fit mismatch penalty off low-signal spots.
 */
export const AI_PUNCHINESS_CONFIDENCE_THRESHOLD = 0.55;

export interface WavePunchinessResolution {
  /** Hand-tuned manual override (beaches.wave_punchiness). */
  override?: number | null;
  /** LLM score distilled from the spot's freetext (beaches.wave_punchiness_ai). */
  ai?: number | null;
  aiConfidence?: number | null;
  persona?: string | null;
  break_type?: string | null;
  skill_level?: string | null;
}

/**
 * Resolve a spot's punchiness by precedence: manual override > confident AI
 * score > structural derivation. Low-confidence AI is ignored in favor of the
 * derivation floor.
 */
export function resolveWavePunchiness(
  input: WavePunchinessResolution
): number | null {
  if (typeof input.override === 'number' && Number.isFinite(input.override)) {
    return input.override;
  }
  if (
    typeof input.ai === 'number' &&
    Number.isFinite(input.ai) &&
    typeof input.aiConfidence === 'number' &&
    input.aiConfidence >= AI_PUNCHINESS_CONFIDENCE_THRESHOLD
  ) {
    return input.ai;
  }
  return deriveWavePunchiness({
    persona: input.persona,
    break_type: input.break_type,
    skill_level: input.skill_level,
  });
}
