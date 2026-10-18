import { isGarminWatchUserAllowed } from "@/lib/flags/garmin-watch";
import { isSessionImportsUserAllowed } from "@/lib/flags/session-imports";

export function canViewSessionWaves(userId: string): boolean {
  return isSessionImportsUserAllowed(userId) || isGarminWatchUserAllowed(userId);
}
