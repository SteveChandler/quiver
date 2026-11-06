import { isEcmwfHybridScaleEnabled } from '@/lib/flags/ecmwf-hybrid-scale';
import { ECMWF_HYBRID_K_FACTORS, ECMWF_HYBRID_R_MAX, ECMWF_HYBRID_R_MIN } from './ecmwf-hybrid-k-factors';
import { METERS_TO_FEET } from './unit-conversions';
import type { SwellComponentInput, WaveHeightSourceTag } from './wave-height-transformer';

/** What the transform applies: components and raw height × r, then × k in place of the production factor. */
export interface EcmwfHybridScale {
  r: number;
  k: number;
}

export interface ResolvedEcmwfHybridScale extends EcmwfHybridScale {
  /** r before the clamp. */
  rRaw: number;
  ecmwfHsM: number;
}

/**
 * The hybrid scale for one model_swell hour, or null to keep the production
 * path: flag off, other source, beach not in the hybrid k table, or no usable
 * ECMWF Hs or component energy at this hour.
 */
export function resolveEcmwfHybridScale(args: {
  beachId: string | null | undefined;
  source: WaveHeightSourceTag | undefined;
  components: ReadonlyArray<SwellComponentInput | null>;
  ecmwfHsM: number | null | undefined;
}): ResolvedEcmwfHybridScale | null {
  const { beachId, source, components, ecmwfHsM } = args;
  if (source !== 'model_swell' || !beachId) return null;
  const k = ECMWF_HYBRID_K_FACTORS[beachId];
  if (k === undefined || !isEcmwfHybridScaleEnabled()) return null;
  if (ecmwfHsM == null || !Number.isFinite(ecmwfHsM) || !(ecmwfHsM > 0)) return null;
  // RSS of the components the transform uses, not the MF total: the total holds energy the transform never sees.
  const rssFt = Math.sqrt(components.reduce((sum, c) => sum + (c ? c.heightFt ** 2 : 0), 0));
  if (!(rssFt > 0)) return null;
  const rRaw = (ecmwfHsM * METERS_TO_FEET) / rssFt;
  const r = Math.min(ECMWF_HYBRID_R_MAX, Math.max(ECMWF_HYBRID_R_MIN, rRaw));
  return { r, k, rRaw, ecmwfHsM };
}
