"use server";

import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { fetchUserBoardContext } from "@/lib/services/discovery/surf-discovery-orchestrator";
import type { BoardClass } from "@/lib/domains/rideability";
import type { PersonalBoard } from "@/lib/scoring/personal-board";

interface BoardPickContext {
  boardClasses: BoardClass[];
  /** Eligible boards with their session history for recommendBoard. */
  boardsForPicks: PersonalBoard[];
}

/**
 * Same board evidence the discovery orchestrator and
 * /api/forecasts/scored feed into recommendBoard, so the web names the same
 * board as native and discovery.
 */
export async function getBoardPickContext() {
  return withAuthenticatedAction<BoardPickContext>(async (user, supabase) => {
    const context = await fetchUserBoardContext(supabase, user.id);
    return {
      boardClasses: context.boardClasses,
      boardsForPicks: context.boardsForPicks as PersonalBoard[],
    };
  });
}
