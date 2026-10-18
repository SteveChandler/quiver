const ERROR_COPY: Record<string, string> = {
  no_gps: "This surf has no GPS track.",
  too_short: "This track is too short to be a surf.",
  bad_time: "This surf's date looks wrong.",
  unsupported_format: "Upload a .fit, .gpx or Garmin .zip file.",
  corrupt: "We couldn't read this surf. Try importing it again.",
  duplicate: "You've already uploaded this surf.",
};

export function importErrorCopy(reason: unknown, fallback = "This surf couldn't be imported."): string {
  if (typeof reason === "string" && Object.prototype.hasOwnProperty.call(ERROR_COPY, reason)) {
    return ERROR_COPY[reason];
  }
  return fallback;
}
