/**
 * Every wave-station source the cron syncs. A source is listed only after its
 * licence was checked to allow commercial use with attribution; see each
 * adapter's header for the evidence.
 */

import { ndbcAdapter } from "./ndbc/adapter";
import type { WaveStationSourceAdapter } from "./types";

export const SOURCE_ADAPTERS: readonly WaveStationSourceAdapter[] = [ndbcAdapter];
