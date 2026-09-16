export function swellFieldLayerIds(
  baseLayerId: string,
  particleLayerIds: readonly string[],
): string[] {
  return [`${baseLayerId}-stage-dim`, baseLayerId, ...particleLayerIds];
}

export function swellFieldLayerOrder(
  baseLayerId: string,
  particleLayerIds: readonly string[],
  stage: "light" | "dark",
): string[] {
  return stage === "dark"
    ? swellFieldLayerIds(baseLayerId, particleLayerIds)
    : [baseLayerId, ...particleLayerIds];
}
