import { BUOY_SCORE_WEIGHTS } from "@/lib/climatology/score";
import { LIGHT_WIND_KT, LONG_PERIOD_S, SMALL_DAY_FT } from "@/lib/climatology/stats";

interface ScoreExplainerProps {
  hasWind: boolean;
  csvHref: string | null;
  scoreVersion: string;
}

const percent = (weight: number): string => `${Math.round(weight * 100)}%`;

export function ScoreExplainer({ hasWind, csvHref, scoreVersion }: ScoreExplainerProps) {
  return (
    <div className="mt-4 rounded-lg border border-[#11100D]/15 bg-[#FBF6E8] p-4 text-sm leading-6 text-[#11100D]">
      <h3 className="text-base font-semibold">How the buoy score works</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>{`${percent(BUOY_SCORE_WEIGHTS.surfDays)}: share of days when the buoy's daytime median reached ${SMALL_DAY_FT} ft`}</li>
        <li>{`${percent(BUOY_SCORE_WEIGHTS.groundswell)}: share of hours with swell of ${LONG_PERIOD_S} seconds or longer`}</li>
        {hasWind && (
          <li>{`${percent(BUOY_SCORE_WEIGHTS.cleanMornings)}: share of mornings (6–9 am) with offshore wind or wind under ${LIGHT_WIND_KT} knots`}</li>
        )}
        <li>{`${percent(BUOY_SCORE_WEIGHTS.waterComfort)}: how comfortable the median water temperature is`}</li>
      </ul>
      {!hasWind && (
        <p className="mt-2">This page has no wind record we trust, so the other three parts are scaled up to fill the score.</p>
      )}
      <p className="mt-2 text-[#655C4C]">
        {`Method ${scoreVersion}. Buoy scores can be compared with each other. The monthly scores on city pages without buoy data use an older method.`}
      </p>
      {csvHref && (
        <a
          href={csvHref}
          download
          className="mt-3 inline-flex font-semibold text-ocean-blue underline-offset-2 hover:underline"
        >
          Download the monthly numbers (CSV)
        </a>
      )}
    </div>
  );
}
