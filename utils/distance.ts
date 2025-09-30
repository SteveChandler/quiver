export function formatMiles(miles?: number, digits = 1) {
  if (typeof miles !== "number" || !Number.isFinite(miles) || miles < 0) {
    return "—";
  }

  const value = miles;

  if (value < 0.05) {
    return "<0.1 mi";
  }

  return `${value.toFixed(digits)} mi`;
}
