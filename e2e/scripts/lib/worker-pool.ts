export const POOL_SIZE = 8;

export function poolEmail(index: number): string {
  return `e2e-worker-${index}@quivertest.local`;
}
