export const BOARD_PICKS_FREE_ENABLED_FLAG = "BOARD_PICKS_FREE_ENABLED";

export function isBoardPicksFreeEnabled(): boolean {
  return process.env[BOARD_PICKS_FREE_ENABLED_FLAG] === "true";
}
