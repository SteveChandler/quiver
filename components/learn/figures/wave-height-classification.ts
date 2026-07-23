export interface WaveHeightClassification {
  significantHeightFt: number;
  faceHeightMinFt: number;
  faceHeightMaxFt: number;
  hawaiianHeightMinFt: number;
  hawaiianHeightMaxFt: number;
  /** Significant height clamped to [0.5, 8], normalized to [0, 1]. */
  t: number;
}

export function classifyWaveHeight(
  significantHeightFt: number,
): WaveHeightClassification {
  const clampedHeight = Math.max(0.5, Math.min(8, significantHeightFt));
  const faceHeightMinFt = clampedHeight * 1.5;
  const faceHeightMaxFt = clampedHeight * 2;

  return {
    significantHeightFt: clampedHeight,
    faceHeightMinFt,
    faceHeightMaxFt,
    hawaiianHeightMinFt: faceHeightMinFt * 0.5,
    hawaiianHeightMaxFt: faceHeightMaxFt * 0.5,
    t: (clampedHeight - 0.5) / 7.5,
  };
}
