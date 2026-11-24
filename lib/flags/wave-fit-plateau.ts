/** Keep the literal access so Next.js can inline the shared wave-fit flag into the browser build. */
export function isWaveFitPlateauEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED === "true";
}
