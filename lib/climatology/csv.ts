import { SECTORS, type ClimatologyMonth, type SurfClimatologyDataset, type WaveMonthStats } from "./types";

const COLUMNS = [
  "month",
  "station_id",
  "role",
  "hs_median_ft",
  "hs_p25_ft",
  "hs_p75_ft",
  "hs_p90_ft",
  "small_day_share",
  "big_day_share",
  "period_under8_share",
  "period_8to10_share",
  "period_10plus_share",
  ...SECTORS.map((sector) => `dir_${sector.toLowerCase()}_share`),
  ...SECTORS.map((sector) => `days_3ft_${sector.toLowerCase()}_share`),
  "water_median_f",
  "water_p10_f",
  "water_p90_f",
  "clean_morning_share",
  "buoy_score_v1",
];

type Cell = string | number | null | undefined;

function row(
  month: ClimatologyMonth,
  stationId: string,
  role: "waves" | "comparison-waves",
  waves: WaveMonthStats | null,
): string {
  // Water, wind and the score belong to the city's primary buoy row only.
  const primary = role === "waves";
  const cells: Cell[] = [
    month.month,
    stationId,
    role,
    waves?.hsFt.median,
    waves?.hsFt.p25,
    waves?.hsFt.p75,
    waves?.hsFt.p90,
    waves?.smallDayShare,
    waves?.bigDayShare,
    waves?.periodMix.under8,
    waves?.periodMix.from8to10,
    waves?.periodMix.atLeast10,
    ...SECTORS.map((sector) => waves?.directionMix[sector]),
    ...SECTORS.map((sector) => waves?.threeFootDaysBySector[sector]),
    primary ? month.water?.medianF : null,
    primary ? month.water?.p10F : null,
    primary ? month.water?.p90F : null,
    primary ? month.wind?.cleanMorningShare : null,
    primary ? month.score : null,
  ];
  return cells.map((cell) => (cell === null || cell === undefined ? "" : String(cell))).join(",");
}

export function datasetToCsv(dataset: SurfClimatologyDataset): string {
  const lines = [
    `# Quiver monthly buoy statistics for ${dataset.cityName}. Method ${dataset.scoreVersion}, generated ${dataset.generatedAt}.`,
    "# Heights are buoy significant wave height in feet, not surf height at the beach.",
    ...dataset.stations.map(
      (station) =>
        `# ${station.role}: ${station.name} (${station.kind === "ndbc" ? "NDBC" : "ASOS"} ${station.id}${
          station.alias ? `, ${station.alias}` : ""
        }), ${station.yearsUsed[0]}-${station.yearsUsed[1]}, gate ${station.gate}. ${station.pageUrl}`,
    ),
    COLUMNS.join(","),
  ];

  const primary = dataset.stations.find((station) => station.role === "waves");
  const comparison = dataset.stations.find(
    (station) => station.role === "comparison-waves" && station.gate === "passed",
  );
  for (const month of dataset.months) {
    if (primary) lines.push(row(month, primary.id, "waves", month.waves));
    if (comparison) lines.push(row(month, comparison.id, "comparison-waves", month.comparisonWaves));
  }
  return `${lines.join("\n")}\n`;
}
