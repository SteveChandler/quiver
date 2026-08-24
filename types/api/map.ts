import type { Beach } from "@/types/database";
import type { WaterQualityHoldStatus } from "@/lib/recommendations/major-event-hold/water-quality";

export type MapBeach = Beach & {
  waterQualityHold: boolean;
  waterQualityStatus: WaterQualityHoldStatus | null;
};
