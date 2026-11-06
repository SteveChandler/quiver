export const ECMWF_HYBRID_SCALE_ENABLED_FLAG = "ECMWF_HYBRID_SCALE_ENABLED";

/** Default on. Set the env var to the literal "false" to put every beach back on the production factor. */
export function isEcmwfHybridScaleEnabled(): boolean {
  return process.env[ECMWF_HYBRID_SCALE_ENABLED_FLAG] !== "false";
}
