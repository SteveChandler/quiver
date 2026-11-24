import type { IPLocationData } from "./types";

export function resolveApproximateOrigin({
  ip,
  browserTimeZone,
  now,
}: {
  ip: IPLocationData | null;
  browserTimeZone: string;
  now: Date;
}): { lat: number; lon: number; label: string; source: "ip" } | null {
  if (
    !ip || ip.synthetic === true || typeof ip.city !== "string" || !ip.city.trim() ||
    typeof ip.latitude !== "number" || !Number.isFinite(ip.latitude) || Math.abs(ip.latitude) > 90 ||
    typeof ip.longitude !== "number" || !Number.isFinite(ip.longitude) || Math.abs(ip.longitude) > 180 ||
    !browserTimeZone
  ) return null;

  try {
    const offsetName = new Intl.DateTimeFormat("en-US", {
      timeZone: browserTimeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(now).find((part) => part.type === "timeZoneName")?.value;
    const offset = offsetName?.match(/^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/);
    if (!offset) return null;
    const hours = (Number(offset[2] ?? 0) + Number(offset[3] ?? 0) / 60) * (offset[1] === "-" ? -1 : 1);
    if (Math.abs(hours - ip.longitude / 15) > 2) return null;
  } catch {
    return null;
  }

  return {
    lat: ip.latitude,
    lon: ip.longitude,
    label: [ip.city.trim(), ip.region].filter(Boolean).join(", "),
    source: "ip",
  };
}
