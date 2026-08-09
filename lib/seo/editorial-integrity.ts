import type { Beach } from "@/types/database";

export interface EditorialIntegrityBeach {
  id: string;
  name: string | null;
  city: string | null;
  state: string | null;
  description?: string | null;
  wave_tips?: string | null;
  crowd_tips?: string | null;
  best_conditions_prose?: string | null;
  parking_tips?: string | null;
  access_tips?: string | null;
  local_etiquette?: string | null;
  hazards?: string[] | null;
}

export interface EditorialIntegrityResult {
  quarantined: boolean;
  reasons: string[];
}

interface LocationReferenceGuard {
  label: string;
  pattern: RegExp;
  allowedStates: string[];
  allowedCities?: string[];
}

const LOCATION_REFERENCE_GUARDS: LocationReferenceGuard[] = [
  {
    label: "Siuslaw River",
    pattern: /\bsiuslaw\s+river\b/i,
    allowedStates: ["OR", "Oregon"],
    allowedCities: ["Florence", "Reedsport"],
  },
];

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function editorialText(beach: EditorialIntegrityBeach): string {
  return [
    beach.description,
    beach.wave_tips,
    beach.crowd_tips,
    beach.best_conditions_prose,
    beach.parking_tips,
    beach.access_tips,
    beach.local_etiquette,
    ...(beach.hazards ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

export function evaluateBeachEditorialIntegrity(
  beach: EditorialIntegrityBeach,
): EditorialIntegrityResult {
  const state = normalized(beach.state);
  const city = normalized(beach.city);
  const text = editorialText(beach);
  const reasons: string[] = [];

  for (const guard of LOCATION_REFERENCE_GUARDS) {
    if (!guard.pattern.test(text)) continue;

    const stateAllowed = guard.allowedStates.some(
      (allowedState) => normalized(allowedState) === state,
    );
    const cityAllowed = guard.allowedCities?.some(
      (allowedCity) => normalized(allowedCity) === city,
    );

    if (!stateAllowed || (guard.allowedCities && !cityAllowed)) {
      reasons.push(`location-reference:${guard.label}`);
    }
  }

  return { quarantined: reasons.length > 0, reasons };
}

/**
 * Remove only editorial fields from a contaminated record. Forecast, access
 * coordinates, hazards metadata, and identity remain available to the page.
 */
export function sanitizeBeachEditorialContent<T extends Beach>(beach: T): T {
  const integrity = evaluateBeachEditorialIntegrity(beach);
  if (!integrity.quarantined) return beach;

  const sanitized = {
    ...beach,
    description: null,
    wave_tips: null,
    crowd_tips: null,
    best_conditions_prose: null,
    parking_tips: null,
    access_tips: null,
    local_etiquette: null,
    hazards: null,
  } as T;

  console.warn("[sanitizeBeachEditorialContent] Editorial content quarantined", {
    beachId: beach.id,
    beachName: beach.name,
    reasons: integrity.reasons,
  });
  return sanitized;
}
