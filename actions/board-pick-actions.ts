"use server";

import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { entitlementFromRow } from "@/lib/alerts/entitlements";
import { isBoardPicksFreeEnabled } from "@/lib/flags/board-picks-free";
import { fetchUserBoardContext } from "@/lib/services/discovery/surf-discovery-orchestrator";
import type { BoardClass } from "@/lib/domains/rideability";
import type { PersonalBoard } from "@/lib/scoring/personal-board";

interface BoardPickContext {
  boardClasses: BoardClass[];
  /** Boards with session history for recommendBoard; empty when picks are gated off. */
  boardsForPicks: PersonalBoard[];
}

/**
 * Same board evidence and entitlement gate the discovery orchestrator and
 * /api/forecasts/scored feed into recommendBoard, so the web names the same
 * board as native and discovery.
 */
export async function getBoardPickContext() {
  return withAuthenticatedAction<BoardPickContext>(async (user, supabase) => {
    const { data: entitlementRow } = await supabase
      .from("user_entitlements")
      .select("is_pro, is_trialing, billing_issue, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    const isPro = entitlementFromRow(entitlementRow ?? null) === "premium";
    const context = await fetchUserBoardContext(
      supabase,
      user.id,
      isPro || isBoardPicksFreeEnabled(),
    );
    return {
      boardClasses: context.boardClasses,
      boardsForPicks: context.boardsForPicks as PersonalBoard[],
    };
  });
}
