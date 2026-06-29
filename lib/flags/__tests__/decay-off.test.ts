import {
  shouldForceNoDecay,
  DECAY_OFF_BEACH_ALLOWLIST,
  DECAY_OFF_BAND,
} from "../decay-off";

type BeachLike = { slug: string; deepwater_decay_factor: number | null };
const beach = (over: Partial<BeachLike> = {}): BeachLike => ({
  slug: "malibu-first-point-surfrider",
  deepwater_decay_factor: 0.6,
  ...over,
});

describe("shouldForceNoDecay", () => {
  const prev = process.env.DECAY_OFF_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.DECAY_OFF_ENABLED;
    else process.env.DECAY_OFF_ENABLED = prev;
  });

  it("is false when the flag is disabled even if allowlisted + in band", () => {
    delete process.env.DECAY_OFF_ENABLED;
    expect(shouldForceNoDecay(beach())).toBe(false);
  });

  it("is true when flag on + allowlisted + in band (0.6)", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach())).toBe(true);
  });

  it("is false when the beach is not allowlisted", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach({ slug: "county-line-malibu-ca" }))).toBe(false);
  });

  it("is false when allowlisted but below the band (<0.5 overshoots)", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach({ deepwater_decay_factor: 0.4 }))).toBe(false);
  });

  it("is false when allowlisted but above the band (>0.8)", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach({ deepwater_decay_factor: 0.9 }))).toBe(false);
  });

  it("is false when the decay factor is null", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach({ deepwater_decay_factor: null }))).toBe(false);
  });

  it("includes band boundaries (0.5 and 0.8 inclusive)", () => {
    process.env.DECAY_OFF_ENABLED = "true";
    expect(shouldForceNoDecay(beach({ deepwater_decay_factor: 0.5 }))).toBe(true);
    expect(shouldForceNoDecay(beach({ deepwater_decay_factor: 0.8 }))).toBe(true);
  });

  it("seeds the allowlist with malibu-first-point-surfrider only", () => {
    expect([...DECAY_OFF_BEACH_ALLOWLIST]).toEqual(["malibu-first-point-surfrider"]);
    expect(DECAY_OFF_BAND).toEqual({ min: 0.5, max: 0.8 });
  });
});
