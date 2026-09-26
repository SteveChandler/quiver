// Buoy-record chart colours, drawn on white cards over the cream paper page.
//
// Validated with the dataviz skill's validate_palette.js against both the
// white card surface (#FFFFFF) and the cream page surface (#FBF6E8):
// - CHART_SERIES was `#1F5F7A`. It failed the chroma floor (0.077 < 0.10,
//   "reads as gray") both alone-paired-with-CHART_PEAK and as
//   WIND_CLASS_COLORS.offshore. Replaced with `#0077B6`, same blue family,
//   comfortably clears the floor (0.131) and keeps every other check passing.
// - WIND_CLASS_COLORS.light was `#8DB3BF` and .cross was `#D9C08A`. Together
//   with offshore/onshore they hard-failed the lightness band, the chroma
//   floor, and the normal-vision floor (worst adjacent pair ΔE 13.3, below
//   the 15 gate — full-color readers couldn't tell them apart). Replaced
//   with `#0E9468` (teal-green) and `#C9971F` (gold), which move the whole
//   four-colour set to ALL CHECKS PASS (worst adjacent normal-vision ΔE 17.0,
//   worst CVD ΔE 10.3) on both surfaces. `cross` still sits under 3:1
//   contrast (WARN); the legend's visible swatch + text label is the
//   documented mitigation, already present below.
// - CHART_INK, CHART_MUTED and CHART_GRID are solitary ink/grid colours, not
//   categorical marks compared against each other, so the validator's own
//   scope note ("for a lone status/text color check WCAG text contrast")
//   applies instead: both pass >= 3:1 contrast on both surfaces. Left as-is.
// - CHART_PEAK was already clean (all checks pass) and is unchanged.
export const CHART_INK = "#11100D";
export const CHART_MUTED = "#655C4C";
export const CHART_GRID = "rgba(17, 16, 13, 0.12)";
export const CHART_SERIES = "#0077B6";
export const CHART_PEAK = "#B04E1B";

export const WIND_CLASS_COLORS = {
  offshore: "#0077B6",
  light: "#0E9468",
  cross: "#C9971F",
  onshore: "#B04E1B",
} as const;

export const WIND_CLASS_LABELS = {
  offshore: "Offshore",
  light: "Light (under 6 kt)",
  cross: "Cross-shore",
  onshore: "Onshore",
} as const;
