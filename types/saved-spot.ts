import type { Beach, Database } from "@/types/database";

type SavedCustomSpot = Pick<
  Database["public"]["Tables"]["custom_spots"]["Row"],
  "id" | "name" | "lat" | "lon" | "break_type" | "nearest_beach_id"
>;

export type SavedSpotTarget =
  | { kind: "beach"; beach: Beach; rank: number | null }
  | {
      kind: "custom_spot";
      customSpot: SavedCustomSpot;
      nearestBeachId: string | null;
      rank: number | null;
    };
