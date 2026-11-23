export interface BeachTrafficWeight {
  beachId: string;
  views30d: number;
  weight: number;
  computedAt: string | null;
  marketKey?: string;
  allocationTier?: "proven" | "adjacent" | "exploration";
}
