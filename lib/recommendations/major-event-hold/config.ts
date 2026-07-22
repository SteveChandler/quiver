import "server-only";

import type { MajorEventHoldMode } from "./types";

export function parseMajorEventHoldMode(
  value: string | null | undefined,
): MajorEventHoldMode {
  if (value === null || value === undefined) return "off";
  if (value === "off" || value === "shadow" || value === "enforce") {
    return value;
  }

  throw new Error(
    `Invalid MAJOR_EVENT_HOLD_MODE: expected off, shadow, or enforce; received ${JSON.stringify(
      value,
    )}`,
  );
}

export const MAJOR_EVENT_HOLD_MODE = parseMajorEventHoldMode(
  process.env.MAJOR_EVENT_HOLD_MODE,
);
