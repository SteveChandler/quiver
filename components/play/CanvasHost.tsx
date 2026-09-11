"use client";

import { useCallback, useEffect, useRef, type ReactElement } from "react";

import {
  completeWave,
  FIXED_TIMESTEP_SECONDS,
  getLiveWaveScore,
  judgeWave,
  stepSimulation,
  tickHeat,
  type BreakDefinition,
  type HeatState,
  type SimulationInput,
  type SimulationState,
  type WaveDefinition,
} from "@/lib/play";
import type { PlayAudio } from "./audio";
import { renderCanvasScene } from "./canvas-renderer";

export interface GameSnapshot {
  simulation: SimulationState;
  heat: HeatState;
  liveScore: number;
}

interface CanvasHostProps {
  definition: BreakDefinition;
  wave: WaveDefinition;
  initialSimulation: SimulationState;
  initialHeat: HeatState;
  active: boolean;
  reducedMotion: boolean;
  audio: PlayAudio;
  onSnapshot(snapshot: GameSnapshot): void;
  onWaveComplete(heat: HeatState, simulation: SimulationState, score: number): void;
}

const IDLE_INPUT: SimulationInput = {
  vertical: 0,
  action: false,
  actionPressed: false,
  actionReleased: false,
};

export function CanvasHost({
  definition,
  wave,
  initialSimulation,
  initialHeat,
  active,
  reducedMotion,
  audio,
  onSnapshot,
  onWaveComplete,
}: CanvasHostProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef(initialSimulation);
  const previousRef = useRef(initialSimulation);
  const heatRef = useRef(initialHeat);
  const inputRef = useRef<SimulationInput>({ ...IDLE_INPUT });
  const verticalKeysRef = useRef({ up: false, down: false });
  const pointerSideRef = useRef<"left" | "right" | null>(null);
  const pointerYRef = useRef(0);
  const finishedRef = useRef(false);
  const frameRef = useRef(0);

  const render = useCallback((interpolation: number): void => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    renderCanvasScene(context, width, height, {
      definition,
      wave,
      current: simulationRef.current,
      previous: previousRef.current,
      interpolation,
      reducedMotion,
    });
  }, [definition, reducedMotion, wave]);

  useEffect(() => {
    simulationRef.current = initialSimulation;
    previousRef.current = initialSimulation;
    heatRef.current = initialHeat;
    finishedRef.current = false;
    inputRef.current = { ...IDLE_INPUT };
    render(0);
  }, [initialHeat, initialSimulation, render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      render(0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return (): void => observer.disconnect();
  }, [render]);

  useEffect(() => {
    if (!active) {
      render(0);
      return;
    }

    let animationFrame = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let lastManeuverCount = simulationRef.current.stats.maneuvers.length;
    let previousPhase = simulationRef.current.phase;

    const finishWave = (): void => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const simulation = simulationRef.current;
      const score = judgeWave(simulation.stats).score;
      const heat = completeWave(heatRef.current, score, simulation.stats.wipeout);
      heatRef.current = heat;
      onSnapshot({ simulation, heat, liveScore: score });
      onWaveComplete(heat, simulation, score);
    };

    const step = (): void => {
      previousRef.current = simulationRef.current;
      simulationRef.current = stepSimulation(
        simulationRef.current,
        inputRef.current,
        definition,
        wave,
      );
      inputRef.current.actionPressed = false;
      inputRef.current.actionReleased = false;

      if (heatRef.current.secondsRemaining <= FIXED_TIMESTEP_SECONDS) {
        heatRef.current = { ...heatRef.current, secondsRemaining: 0 };
        finishWave();
        return;
      }
      heatRef.current = tickHeat(heatRef.current, FIXED_TIMESTEP_SECONDS);

      const simulation = simulationRef.current;
      if (simulation.pumping && frameRef.current % 12 === 0) audio.pump();
      if (simulation.stats.maneuvers.length > lastManeuverCount) {
        audio.maneuver(simulation.stats.maneuvers.at(-1)?.type ?? "bottom-turn");
        lastManeuverCount = simulation.stats.maneuvers.length;
      }
      if (previousPhase !== "wipeout" && simulation.phase === "wipeout") audio.wipeout();
      if (previousPhase === "wipeout" && simulation.phase === "complete") audio.gasp();
      previousPhase = simulation.phase;

      frameRef.current += 1;
      if (frameRef.current % 6 === 0) {
        onSnapshot({
          simulation,
          heat: heatRef.current,
          liveScore: getLiveWaveScore(simulation),
        });
      }
      if (simulation.phase === "complete") finishWave();
    };

    const loop = (time: number): void => {
      const frameSeconds = Math.min(0.1, (time - lastTime) / 1_000);
      lastTime = time;
      accumulator += frameSeconds;
      while (accumulator >= FIXED_TIMESTEP_SECONDS && !finishedRef.current) {
        step();
        accumulator -= FIXED_TIMESTEP_SECONDS;
      }
      render(accumulator / FIXED_TIMESTEP_SECONDS);
      if (!finishedRef.current) animationFrame = requestAnimationFrame(loop);
    };

    const handleVisibility = (): void => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrame);
        return;
      }
      lastTime = performance.now();
      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", handleVisibility);
    return (): void => {
      cancelAnimationFrame(animationFrame);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active, audio, definition, onSnapshot, onWaveComplete, render, wave]);

  useEffect(() => {
    if (!active) return;
    const updateVertical = (): void => {
      inputRef.current.vertical = verticalKeysRef.current.up
        ? 1
        : verticalKeysRef.current.down ? -1 : 0;
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!["ArrowUp", "ArrowDown", " "].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowUp") verticalKeysRef.current.up = true;
      if (event.key === "ArrowDown") verticalKeysRef.current.down = true;
      if (event.key === " " && !inputRef.current.action) {
        inputRef.current.action = true;
        inputRef.current.actionPressed = true;
      }
      updateVertical();
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (!["ArrowUp", "ArrowDown", " "].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowUp") verticalKeysRef.current.up = false;
      if (event.key === "ArrowDown") verticalKeysRef.current.down = false;
      if (event.key === " " && inputRef.current.action) {
        inputRef.current.action = false;
        inputRef.current.actionReleased = true;
      }
      updateVertical();
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp, { passive: false });
    return (): void => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [active]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!active) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const side = event.clientX - rect.left < rect.width / 2 ? "left" : "right";
    pointerSideRef.current = side;
    pointerYRef.current = event.clientY;
    if (side === "right") {
      inputRef.current.action = true;
      inputRef.current.actionPressed = true;
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (pointerSideRef.current !== "left") return;
    const delta = pointerYRef.current - event.clientY;
    inputRef.current.vertical = delta > 3 ? 1 : delta < -3 ? -1 : 0;
    pointerYRef.current = event.clientY;
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (pointerSideRef.current === "right" && inputRef.current.action) {
      inputRef.current.action = false;
      inputRef.current.actionReleased = true;
    }
    inputRef.current.vertical = 0;
    pointerSideRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="block h-full min-h-[calc(100svh-120px)] w-full touch-none bg-[#0D1020] sm:min-h-[600px]"
      aria-label={`Side-on surf at ${definition.name}. Use up and down arrows to move on the face, and hold then release Space to maneuver.`}
      role="img"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
