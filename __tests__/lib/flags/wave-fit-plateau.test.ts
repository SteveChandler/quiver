import { isWaveFitPlateauEnabled } from "@/lib/flags/wave-fit-plateau";

describe("isWaveFitPlateauEnabled", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("turns on from the public variable the browser build sees", () => {
    process.env.NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED = "true";
    expect(isWaveFitPlateauEnabled()).toBe(true);
  });

  it("ignores the server-only variable when the public variable is unset", () => {
    process.env.WAVE_FIT_PLATEAU_ENABLED = "true";
    delete process.env.NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED;
    expect(isWaveFitPlateauEnabled()).toBe(false);
  });
});
