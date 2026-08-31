import "server-only";

import { createServiceRoleClient } from "@/lib/supabase";
import {
  createTrustedForecastServingProjectionStore,
  type TrustedForecastServingProjectionStore,
} from "./trusted-forecast-current-projection";

export function createSupabaseTrustedForecastServingProjectionStore(): TrustedForecastServingProjectionStore {
  return createTrustedForecastServingProjectionStore(createServiceRoleClient);
}
