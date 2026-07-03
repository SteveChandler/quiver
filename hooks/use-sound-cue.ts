"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SoundCue = "sonar-ping" | "im-in-thump";

const STORAGE_KEY = "quiver.sound.muted";

interface UseSoundCueResult {
  play: (cue: SoundCue) => void;
  isMuted: boolean;
  toggleMute: () => void;
}

function readMutedFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMutedToStorage(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

type AudioCtor = typeof AudioContext;

function resolveAudioContextCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioCtor;
    webkitAudioContext?: AudioCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Small Web Audio hook for UI cues. Synthesizes sine + noise tones so we
 * don't ship mp3 assets for V1. Respects a localStorage mute toggle.
 *
 * Never autoplays — `play(cue)` must be called from a user gesture the
 * first time; the AudioContext is created lazily on first play.
 */
export function useSoundCue(): UseSoundCueResult {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setIsMuted(readMutedFromStorage());
  }, []);

  const ensureContext = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) return null;
    try {
      ctxRef.current = new Ctor();
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playSonarPing = useCallback((ctx: AudioContext): void => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }, []);

  const playImInThump = useCallback((ctx: AudioContext): void => {
    const bufferSize = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 260;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + 0.16);
  }, []);

  const play = useCallback(
    (cue: SoundCue): void => {
      if (isMuted) return;
      const ctx = ensureContext();
      if (!ctx) return;
      // Some browsers create the context in a suspended state until a
      // user gesture; resume() is a no-op if already running.
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
      try {
        if (cue === "sonar-ping") {
          playSonarPing(ctx);
        } else {
          playImInThump(ctx);
        }
      } catch {
        /* audio failures should never break UI */
      }
    },
    [ensureContext, isMuted, playImInThump, playSonarPing],
  );

  const toggleMute = useCallback((): void => {
    setIsMuted((prev) => {
      const next = !prev;
      writeMutedToStorage(next);
      return next;
    });
  }, []);

  return { play, isMuted, toggleMute };
}
