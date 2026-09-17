import { localDateTimeToUTC } from "@/lib/utils/forecast-time-resolver";
import { getLocalDateString, getLocalHour } from "@/lib/utils/timezone-utils";

export type DailyCallTime =
  | "05:00"
  | "05:30"
  | "06:00"
  | "06:30"
  | "07:00"
  | "07:30"
  | "08:00"
  | "sunrise";

export const DAILY_CALL_TIMES = [
  "05:00",
  "05:30",
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "sunrise",
] as const satisfies readonly DailyCallTime[];

export const DEFAULT_DAILY_CALL_TIME: DailyCallTime = "06:00";

export function parseDailyCallTime(value: unknown): DailyCallTime {
  return typeof value === "string" && DAILY_CALL_TIMES.includes(value as DailyCallTime)
    ? value as DailyCallTime
    : DEFAULT_DAILY_CALL_TIME;
}

export function resolveSendInstant(args: {
  pref: DailyCallTime;
  localDate: string;
  timezone: string;
  sunrise: Date | null;
}): Date {
  if (args.pref === "sunrise" && args.sunrise) return new Date(args.sunrise);
  const time = args.pref === "sunrise" ? DEFAULT_DAILY_CALL_TIME : args.pref;
  const instant = localDateTimeToUTC(args.localDate, `${time}:00`, args.timezone);
  const expectedHour = Number(time.slice(0, 2));
  const actualHour = getLocalHour(instant, args.timezone);
  let correctionHours = expectedHour - actualHour;
  if (correctionHours > 12) correctionHours -= 24;
  if (correctionHours < -12) correctionHours += 24;
  return new Date(instant.getTime() + correctionHours * 60 * 60 * 1000);
}

export function isSendHour(args: {
  now: Date;
  pref: DailyCallTime;
  timezone: string;
  sunrise: Date | null;
}): boolean {
  const sendInstant = resolveSendInstant({
    pref: args.pref,
    localDate: getLocalDateString(args.now, args.timezone),
    timezone: args.timezone,
    sunrise: args.sunrise,
  });
  const elapsedMs = args.now.getTime() - sendInstant.getTime();
  return elapsedMs >= 0 && elapsedMs < 60 * 60 * 1000;
}
