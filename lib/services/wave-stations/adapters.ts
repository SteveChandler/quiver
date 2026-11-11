/**
 * Every wave-station source the cron syncs. A source is listed only after its
 * licence was checked to allow commercial use with attribution; see each
 * adapter's header for the evidence.
 */

import { aodnAdapter } from "./aodn/adapter";
import { fmiAdapter } from "./fmi/adapter";
import { marineIeAdapter } from "./marine-ie/adapter";
import { ndbcAdapter } from "./ndbc/adapter";
import { smhiAdapter } from "./smhi/adapter";
import type { WaveStationSourceAdapter } from "./types";

/** Registry order. The duplicate pass runs after each source, so the order does not change the result. */
export const SOURCE_ADAPTERS: readonly WaveStationSourceAdapter[] = [
  ndbcAdapter,
  marineIeAdapter,
  aodnAdapter,
  fmiAdapter,
  smhiAdapter,
];
