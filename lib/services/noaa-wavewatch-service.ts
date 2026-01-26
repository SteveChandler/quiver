/**
 * NOAA WaveWatch III Service - Legacy Export
 *
 * This file maintains backwards compatibility by re-exporting from the refactored module.
 * New code should import from '@/lib/services/noaa-wavewatch' instead.
 *
 * @deprecated Import from '@/lib/services/noaa-wavewatch' instead
 */

export { NOAAWaveWatchService } from "./noaa-wavewatch";
export type { WaveWatchData, WaveWatchForecast } from "./noaa-wavewatch";
