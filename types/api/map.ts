import type { Beach } from "@/types/database";

export type MapBeach = Beach & {
  waterQualityHold: boolean;
};
