"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";

type CoachPickRow = {
  pick_rank: number;
  beach_id: string;
  name: string;
  distance_km: number | null;
  score: number;
};

export async function getCoachPicksForBeach(
  beachId: string,
  radiusKm: number = 80
): Promise<CoachPickRow[]> {
  return withDatabaseOperation<CoachPickRow[]>(async (supabase) => {
    const { data, error } = await supabase.rpc("get_coach_picks", {
      _beach_id: beachId,
      _radius_km: radiusKm,
    });
    if (error) {
      throw error;
    }
    return (data as CoachPickRow[]) || [];
  });
}


