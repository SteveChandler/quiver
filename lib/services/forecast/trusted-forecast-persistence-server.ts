import "server-only";

import { createServiceRoleClient } from "@/lib/supabase";
import {
  createTrustedForecastPersistenceStore,
  type TrustedForecastPersistenceStore,
} from "./trusted-forecast-persistence";

export function createSupabaseTrustedForecastPersistenceStore(): TrustedForecastPersistenceStore {
  return createTrustedForecastPersistenceStore(createServiceRoleClient);
}
