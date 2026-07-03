import { act, renderHook } from "@testing-library/react";
import { useSoundCue } from "@/hooks/use-sound-cue";

interface FakeGain {
  gain: {
    setValueAtTime: jest.Mock;
    exponentialRampToValueAtTime: jest.Mock;
  };
  connect: jest.Mock;
}

interface FakeOscillator {
  type: string;
  frequency: { setValueAtTime: jest.Mock };
  connect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
}

interface FakeBufferSource {
  buffer: unknown;
  connect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
}

interface FakeContext {
  state: string;
  currentTime: number;
  sampleRate: number;
  createOscillator: jest.Mock<FakeOscillator>;
  createGain: jest.Mock<FakeGain>;
  createBiquadFilter: jest.Mock;
  createBuffer: jest.Mock;
  createBufferSource: jest.Mock<FakeBufferSource>;
  resume: jest.Mock;
  destination: unknown;
}

function makeGain(): FakeGain {
  const gain: FakeGain = {
    gain: {
      setValueAtTime: jest.fn(),
      exponentialRampToValueAtTime: jest.fn(),
    },
    connect: jest.fn(),
  };
  gain.connect.mockReturnValue(gain);
  return gain;
}

function makeOscillator(): FakeOscillator {
  const osc: FakeOscillator = {
    type: "sine",
    frequency: { setValueAtTime: jest.fn() },
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  };
  osc.connect.mockReturnValue(osc);
  return osc;
}

function makeBufferSource(): FakeBufferSource {
  const source: FakeBufferSource = {
    buffer: null,
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  };
  source.connect.mockReturnValue(source);
  return source;
}

function buildFakeContext(): FakeContext {
  const filter = {
    type: "lowpass",
    frequency: { value: 0 },
    connect: jest.fn(),
  };
  (filter.connect as jest.Mock).mockReturnValue(filter);

  const ctx: FakeContext = {
    state: "running",
    currentTime: 0,
    sampleRate: 44100,
    createOscillator: jest.fn(() => makeOscillator()),
    createGain: jest.fn(() => makeGain()),
    createBiquadFilter: jest.fn(() => filter),
    createBuffer: jest.fn(() => ({ getChannelData: () => new Float32Array(64) })),
    createBufferSource: jest.fn(() => makeBufferSource()),
    resume: jest.fn(),
    destination: {},
  };
  return ctx;
}

describe("useSoundCue", () => {
  const originalAudioContext = (
    globalThis as unknown as { AudioContext?: unknown }
  ).AudioContext;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    (globalThis as unknown as { AudioContext?: unknown }).AudioContext =
      originalAudioContext;
    jest.restoreAllMocks();
  });

  it("persists mute preference to localStorage across toggles", () => {
    const { result, rerender } = renderHook(() => useSoundCue());

    expect(result.current.isMuted).toBe(false);
    act(() => {
      result.current.toggleMute();
    });
    expect(result.current.isMuted).toBe(true);
    expect(window.localStorage.getItem("quiver.sound.muted")).toBe("1");

    // A fresh render should read the stored value.
    rerender();
    const second = renderHook(() => useSoundCue());
    expect(second.result.current.isMuted).toBe(true);
  });

  it("does not construct an AudioContext when muted", () => {
    const ctor = jest.fn().mockImplementation(buildFakeContext);
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = ctor;

    const { result } = renderHook(() => useSoundCue());
    act(() => {
      result.current.toggleMute();
    });

    act(() => {
      result.current.play("sonar-ping");
      result.current.play("im-in-thump");
    });

    expect(ctor).not.toHaveBeenCalled();
  });

  it("plays the sonar-ping cue via oscillator when unmuted", () => {
    const ctxs: FakeContext[] = [];
    const ctor = jest.fn().mockImplementation(() => {
      const ctx = buildFakeContext();
      ctxs.push(ctx);
      return ctx;
    });
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = ctor;

    const { result } = renderHook(() => useSoundCue());
    act(() => {
      result.current.play("sonar-ping");
    });

    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctxs[0].createOscillator).toHaveBeenCalledTimes(1);
  });
});
