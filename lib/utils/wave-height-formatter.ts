import {
  transformToFaceHeight,
  type BeachTerrainConfig,
} from './wave-height-transformer';

/**
 * Parse wave height from various formats to get numeric value
 * @param waveHeight Wave height as number, string, or null/undefined
 * @returns Numeric wave height in feet or undefined
 */
export function parseWaveHeight(
  waveHeight?: number | string | null
): number | undefined {
  if (waveHeight === null || waveHeight === undefined || waveHeight === "")
    return undefined;

  // If it's already a number, return it
  if (typeof waveHeight === "number") {
    return waveHeight;
  }

  // If it's a string, try to parse it
  if (typeof waveHeight === "string") {
    // Handle formats like "4 ft", "4ft", "4.5 ft", "4-5 ft", etc.
    const match = waveHeight.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = parseFloat(match[1]);
      return isNaN(parsed) ? undefined : parsed;
    }
  }

  return undefined;
}

/**
 * Format wave height for display in badges and UI
 * @param waveHeight Wave height in feet (number, string, or null/undefined)
 * @returns Formatted wave height string (e.g., "2-3ft", "8ft+")
 */
export function formatWaveHeight(waveHeight?: number | string | null): string {
  const parsed = parseWaveHeight(waveHeight);

  if (!parsed || parsed === 0) return "0-1ft";

  if (parsed < 1) return "0-1ft";
  if (parsed < 2) return "1-2ft";
  if (parsed < 3) return "2-3ft";
  if (parsed < 4) return "3-4ft";
  if (parsed < 5) return "4-5ft";
  if (parsed < 6) return "5-6ft";
  if (parsed < 8) return "6-8ft";
  if (parsed < 10) return "8-10ft";
  return `${Math.floor(parsed)}ft+`;
}

/**
 * Get the raw numeric wave height value from any format
 * @param waveHeight Wave height in any format
 * @returns Numeric value or undefined
 */
export function getWaveHeightValue(
  waveHeight?: number | string | null
): number | undefined {
  return parseWaveHeight(waveHeight);
}

/**
 * Convert various swell/height inputs to a display face height in feet.
 *
 * Applies beach-specific wave transformation including:
 * - Base shoaling factor (1.6x) - waves steepen approaching shore
 * - Period amplification - longer periods = bigger faces
 * - Direction factor from terrain swell_access_factors
 *
 * Rules for source selection:
 * - Prefer CDIP significant height when available and reasonable
 * - Fall back to model primary swell, then CDIP swell, then model Hs
 * - Clamp to reasonable local range [0.5ft, 15ft] to avoid obvious spikes
 */
export function toFaceHeightFeet(params: {
  cdipSigFt?: number | null;
  cdipSwellFt?: number | null;
  modelSwellM?: number | null;
  modelHsM?: number | null;
  // Beach terrain configuration for direction factor
  beach?: BeachTerrainConfig | null;
  // Wave period in seconds for period amplification
  periodS?: number | null;
  // Swell direction in degrees for terrain-based direction factor
  swellDirectionDeg?: number | null;
}): string | null {
  const mToFt = (m?: number | null) =>
    m == null || !isFinite(m) ? undefined : m * 3.28084;
  const roundFt = (ft: number) => Math.round(ft * 10) / 10;
  // Clamp increased to 15ft to allow for larger transformed swells
  const clamp = (ft: number) => Math.min(15, Math.max(0.5, ft));

  const cdipSig = params.cdipSigFt != null && isFinite(params.cdipSigFt)
    ? params.cdipSigFt
    : undefined;
  const cdipSwell = params.cdipSwellFt != null && isFinite(params.cdipSwellFt)
    ? params.cdipSwellFt
    : undefined;
  const modelSwell = mToFt(params.modelSwellM);
  const modelHs = mToFt(params.modelHsM);

  /**
   * Helper to transform raw height to face height using beach-specific factors
   */
  const toFace = (rawFt: number): number => {
    return transformToFaceHeight({
      rawHeightFt: rawFt,
      periodS: params.periodS ?? null,
      swellDirectionDeg: params.swellDirectionDeg ?? null,
      beach: params.beach ?? null,
    });
  };

  // Prefer CDIP significant height when available and within reasonable range
  if (cdipSig !== undefined && cdipSig <= 10) {
    // If we also have model swell and CDIP is a large outlier vs model, defer to model
    if (modelSwell !== undefined && cdipSig > modelSwell * 1.8) {
      const face = clamp(toFace(modelSwell));
      return `${roundFt(face)} ft`;
    }
    const face = clamp(toFace(cdipSig));
    return `${roundFt(face)} ft`;
  }

  // Prefer model primary swell
  if (modelSwell !== undefined) {
    const face = clamp(toFace(modelSwell));
    return `${roundFt(face)} ft`;
  }

  // CDIP swell as fallback
  if (cdipSwell !== undefined) {
    const face = clamp(toFace(cdipSwell));
    return `${roundFt(face)} ft`;
  }

  // Model Hs as last resort
  if (modelHs !== undefined) {
    const face = clamp(toFace(modelHs));
    return `${roundFt(face)} ft`;
  }

  return null;
}
