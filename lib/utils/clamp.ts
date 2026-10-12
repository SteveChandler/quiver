/** Bounds `value` to [lo, hi]; a non-finite value becomes `lo`. */
export function clamp(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
}
