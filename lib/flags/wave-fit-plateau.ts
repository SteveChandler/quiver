const WAVE_FIT_PLATEAU_ENABLED_FLAG = "WAVE_FIT_PLATEAU_ENABLED";

/** Beach Detail also scores in the browser, so its build needs the public companion flag. */
export function isWaveFitPlateauEnabled(): boolean {
  return process.env[WAVE_FIT_PLATEAU_ENABLED_FLAG] === "true"
    || process.env.NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED === "true";
}
