import { normalizeForecastDateParam, normalizeForecastWindowParam } from "@/lib/utils/forecast-window-param";
import { getLocalDateString } from "@/lib/utils/timezone-utils";

export function ripCurrentDateFor({
  dateParam,
  windowParam,
  forecastLocalDate,
  todayLocalDate,
  timezone,
}: {
  dateParam: string | null;
  windowParam: string | null;
  forecastLocalDate: string | null;
  todayLocalDate: string;
  timezone: string;
}): string {
  const selectedDate = normalizeForecastDateParam(dateParam);
  if (selectedDate) return selectedDate;

  const selectedWindow = normalizeForecastWindowParam(windowParam);
  if (selectedWindow) return getLocalDateString(new Date(selectedWindow), timezone);

  return forecastLocalDate ?? todayLocalDate;
}
