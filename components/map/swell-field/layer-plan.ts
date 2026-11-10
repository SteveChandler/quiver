export function swellFieldLayerIds(
  baseLayerId: string,
  particleLayerIds: readonly string[],
): string[] {
  return [`${baseLayerId}-stage-dim`, baseLayerId, ...particleLayerIds];
}

