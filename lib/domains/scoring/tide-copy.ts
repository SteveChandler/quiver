/** User-facing tide-swing strings. Kept together so web, native and copy reviews read one source. */

export const TIDE_SWING_COPY = {
  wallsUpDraining: 'Dropping fast, expect it to wall up as it drains',
  reefTurningOff: 'Turning off as it drains',
  fillingIn: 'Filling in, turns on as it covers',
  slackHighWater: 'Lots of water at the top of the tide',
} as const;

/** `when` is a clock phrase ("by ~1 PM") or "within the hour". */
export function tideBackInRangeCopy(when: string): string {
  return `Tide back in range ${when}`;
}

export function tideLeavesRangeCopy(when: string): string {
  return `Tide leaves its best range ${when}`;
}

export const TIDE_WITHIN_THE_HOUR = 'within the hour';
