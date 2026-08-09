// This adapter exists precisely BECAUSE `server-only` is not an installed
// dependency: forecast-builder falls back here when importing the `-server`
// variant throws MODULE_NOT_FOUND under plain Node. Importing `server-only`
// here would make the fallback throw the same error it is catching, so the
// browser guard is enforced at runtime instead.
import { assertNotBrowser } from "./trusted-forecast-runtime-guard";
import { createServiceRoleClient } from "@/lib/supabase";
import {
  createTrustedForecastPersistenceStore,
  type TrustedForecastPersistenceStore,
} from "./trusted-forecast-persistence";

export function createSupabaseTrustedForecastPersistenceStore(): TrustedForecastPersistenceStore {
  assertNotBrowser("trusted-forecast-persistence-node");
  return createTrustedForecastPersistenceStore(createServiceRoleClient);
}
