import { GATE_COVERAGE } from "@/lib/climatology/coverage";
import type { SeasonCopy } from "@/lib/climatology/season-copy";
import type { SeasonPhoto, SeasonPhotoSlot } from "@/lib/climatology/season-photos";
import { MONTH_ABBREVS, SEASONS, seasonalDirectionMix, type DataBackedSeasonView } from "@/lib/climatology/season-view";
import type { ClimatologyStation, Sector, SurfClimatologyDataset } from "@/lib/climatology/types";
import { BuoyMonthTable } from "./buoy-month-table";
import { DirectionMixChart } from "./direction-mix-chart";
import { ScoreByMonthChart } from "./score-by-month-chart";
import { ScoreExplainer } from "./score-explainer";
import { SeasonPhotoFigure } from "./season-photo";
import { SourceLine } from "./source-line";
import { StationMap } from "./station-map";
import { SwellDaysChart } from "./swell-days-chart";
import { WaveRangeChart } from "./wave-range-chart";
import { WindByTimeChart } from "./wind-by-time-chart";

interface BuoyRecordSectionsProps {
  dataset: SurfClimatologyDataset;
  view: DataBackedSeasonView;
  copy: SeasonCopy | null;
  photos: SeasonPhoto[];
  csvHref: string | null;
}

// A wind source can fail on coverage or on the sea-breeze check; say which.
function describeFailedStation(station: ClimatologyStation): string {
  const code = station.kind === "ndbc" ? `NDBC ${station.id}` : station.id;
  if (station.gateCoverage < GATE_COVERAGE) {
    return `${station.name} (${code}) had ${Math.round(station.gateCoverage * 100)}% of hours recorded, below our ${Math.round(
      GATE_COVERAGE * 100,
    )}% bar, so this page doesn't use it.`;
  }
  return `${station.name} (${code}) didn't show the summer afternoon sea breeze we check wind records for, so this page doesn't use it.`;
}

function sumSectors(shares: Record<Sector, number>, sectors: readonly Sector[]): number {
  return Math.round(sectors.reduce((sum, sector) => sum + shares[sector], 0) * 100) / 100;
}

const SECTION = "mb-12";
const HEADING = "mb-4 text-2xl font-semibold text-gray-900";
const CARD = "rounded-xl border border-gray-200 bg-white p-4 shadow-sm";
const PROSE = "max-w-3xl space-y-3 text-[15px] leading-7 text-[#11100D]";

export function BuoyRecordSections({ dataset, view, copy, photos, csvHref }: BuoyRecordSectionsProps) {
  const context = { dataset, view };
  const photosFor = (slots: SeasonPhotoSlot[]) => photos.filter((photo) => slots.includes(photo.slot));
  const midPhotos = photosFor(copy?.seasonNote ? ["big-swell", "typical-day"] : ["big-swell", "typical-day", "south-swell"]);
  const seasonNotePhotos = copy?.seasonNote ? photosFor(["south-swell"]) : [];
  const comparisonPhotos = photosFor(["comparison-north", "comparison-south"]);
  const limitsPhotos = photosFor(["buoy-limits"]);
  const mapStations = [view.primary, view.comparison, view.wind].filter(
    (station): station is NonNullable<typeof station> => station !== null,
  );
  const directionRows = [
    {
      stationName: view.primary.name,
      seasons: SEASONS.map((season) => ({ label: season.label, mix: seasonalDirectionMix(dataset, "waves", season.months) })),
    },
    ...(view.comparison
      ? [
          {
            stationName: view.comparison.name,
            seasons: SEASONS.map((season) => ({
              label: season.label,
              mix: seasonalDirectionMix(dataset, "comparison-waves", season.months),
            })),
          },
        ]
      : []),
  ];

  return (
    <>
      {copy && (
        <section className={SECTION}>
          <h2 className={HEADING}>{copy.answerHeading(context)}</h2>
          <div className={PROSE}>
            {copy.answer(context).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      )}

      <section className={SECTION}>
        <h2 className={HEADING}>Buoy score by month</h2>
        <div className={CARD}>
          <ScoreByMonthChart months={view.months} stationName={view.primary.name} chartId="buoy-score" />
        </div>
        <SourceLine station={view.primary} scoreVersion={dataset.scoreVersion} />
        <ScoreExplainer hasWind={view.wind !== null} csvHref={csvHref} scoreVersion={dataset.scoreVersion} />
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>Month by month at the buoy</h2>
        <BuoyMonthTable months={view.months} station={view.primary} />
        <SourceLine station={view.primary} scoreVersion={dataset.scoreVersion} />
      </section>

      {copy?.seasonNote && (
        <section className={SECTION}>
          <h2 className={HEADING}>{copy.seasonNote.heading}</h2>
          {copy.seasonNote.chart && (
            <>
              <div className={CARD}>
                <SwellDaysChart
                  abbrevs={MONTH_ABBREVS}
                  primary={{
                    label: copy.seasonNote.chart.primaryLabel,
                    values: view.months.map((month) =>
                      month.waves ? sumSectors(month.waves.threeFootDaysBySector, copy.seasonNote?.chart?.primarySectors ?? []) : null,
                    ),
                  }}
                  secondary={{
                    label: copy.seasonNote.chart.secondaryLabel,
                    values: view.months.map((month) =>
                      month.waves ? sumSectors(month.waves.threeFootDaysBySector, copy.seasonNote?.chart?.secondarySectors ?? []) : null,
                    ),
                  }}
                  stationName={view.primary.name}
                  chartId="buoy-swell-days"
                />
              </div>
              <SourceLine station={view.primary} scoreVersion={dataset.scoreVersion} />
            </>
          )}
          <div className={`${PROSE} mt-4`}>
            {copy.seasonNote.paragraphs(context).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {seasonNotePhotos.map((photo) => (
            <SeasonPhotoFigure key={photo.slot} photo={photo} className="mt-6 max-w-xl" />
          ))}
        </section>
      )}

      <section className={SECTION}>
        <h2 className={HEADING}>How big the buoy reads each month</h2>
        <div className={CARD}>
          <WaveRangeChart months={view.months} stationName={view.primary.name} chartId="buoy-waves" />
        </div>
        <SourceLine station={view.primary} scoreVersion={dataset.scoreVersion} />
        {midPhotos.length > 0 && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {midPhotos.map((photo) => (
              <SeasonPhotoFigure key={photo.slot} photo={photo} />
            ))}
          </div>
        )}
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>Where the swell comes from</h2>
        <div className={CARD}>
          <DirectionMixChart rows={directionRows} chartId="buoy-direction" />
        </div>
        <SourceLine station={view.primary} scoreVersion={dataset.scoreVersion} />
        {view.comparison && <SourceLine station={view.comparison} scoreVersion={dataset.scoreVersion} />}
      </section>

      {view.wind && (
        <section className={SECTION}>
          <h2 className={HEADING}>Wind by time of day</h2>
          <div className={CARD}>
            <WindByTimeChart
              months={dataset.months.map((month, index) => ({
                month: month.month,
                abbrev: view.months[index].abbrev,
                wind: month.wind,
              }))}
              stationName={view.wind.name}
              chartId="buoy-wind"
            />
          </div>
          <SourceLine station={view.wind} scoreVersion={dataset.scoreVersion} />
        </section>
      )}

      {copy && (
        <section className={SECTION}>
          <h2 className={HEADING}>{copy.comparisonHeading}</h2>
          <div className={PROSE}>
            {copy.comparison(context).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {comparisonPhotos.length > 0 && (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {comparisonPhotos.map((photo) => (
                <SeasonPhotoFigure key={photo.slot} photo={photo} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className={SECTION}>
        <h2 className={HEADING}>Where these numbers come from</h2>
        <StationMap places={dataset.places} stations={mapStations} />
        {view.failedStations.map((station) => (
          <p key={station.id} className="mt-2 text-xs leading-5 text-[#655C4C]">
            {describeFailedStation(station)}
          </p>
        ))}
        {view.primary.excludedStationMonths.length > 0 && (
          <p className="mt-2 text-xs leading-5 text-[#655C4C]">
            {`Months left out because the buoy recorded less than 70% of their hours: ${view.primary.excludedStationMonths.join(", ")}.`}
          </p>
        )}
      </section>

      {copy && (
        <section className={SECTION}>
          <h2 className={HEADING}>{copy.limitsHeading}</h2>
          <div className={PROSE}>
            {copy.limits(context).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {limitsPhotos.map((photo) => (
            <SeasonPhotoFigure key={photo.slot} photo={photo} className="mt-6 max-w-xl" />
          ))}
          <ul className="mt-4 space-y-1 text-xs text-[#655C4C]">
            {copy.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
