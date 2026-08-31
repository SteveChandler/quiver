import { createServiceRoleClient } from "@/lib/supabase";
import { assertNotBrowser } from "./trusted-forecast-runtime-guard";
import {
  createTrustedForecastServingProjectionStore,
  type TrustedForecastServingProjectionStore,
} from "./trusted-forecast-current-projection";

export function createSupabaseTrustedForecastServingProjectionStore(): TrustedForecastServingProjectionStore {
  assertNotBrowser("trusted-forecast-current-projection-node");
  return createTrustedForecastServingProjectionStore(createServiceRoleClient);
}
