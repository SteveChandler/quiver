interface RampStep {
  heightFt: number;
  faceHeightFt: number | null;
}

interface PartitionRamp {
  start: number;
  end: number;
  arrival: number;
  peak: number;
}

/**
 * The ramp is the contiguous run of one tracked partition around a gated episode whose height
 * stays above baseline. Peak is its highest projected face; arrival is the first step at or after
 * the ramp start whose rise reaches `arrivalRiseFraction` of the peak step's rise.
 */
export function findPartitionRamp(input: {
  steps: readonly RampStep[];
  episodeStart: number;
  episodeEnd: number;
  baselineHeightFt: number;
  arrivalRiseFraction: number;
}): PartitionRamp | null {
  const { steps, baselineHeightFt } = input;
  const rises = steps.map((step) => step.heightFt - baselineHeightFt);
  let start = input.episodeStart;
  while (start > 0 && rises[start - 1] > 0) start -= 1;
  let end = input.episodeEnd;
  while (end < steps.length - 1 && rises[end + 1] > 0) end += 1;
  let peak = -1;
  for (let index = start; index <= end; index++) {
    const face = steps[index].faceHeightFt;
    if (face === null || !Number.isFinite(face)) continue;
    const best = peak < 0 ? null : steps[peak].faceHeightFt;
    if (best === null || face > best) peak = index;
  }
  if (peak < 0) return null;
  const threshold = rises[peak] * input.arrivalRiseFraction;
  for (let arrival = start; arrival <= peak; arrival++) {
    if (rises[arrival] >= threshold) return { start, end, arrival, peak };
  }
  return null;
}
