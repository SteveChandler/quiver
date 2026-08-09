import { createServiceRoleClient } from "@/lib/supabase";
import {
  createTrustedForecastReadStore,
  type TrustedForecastReadStore,
} from "./trusted-forecast-repository";

export function createSupabaseTrustedForecastReadStore(): TrustedForecastReadStore {
  return createTrustedForecastReadStore(createServiceRoleClient);
}
