"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";

import {
  BREAKS,
  createHeatState,
  createProgressStore,
  createSimulationState,
  DEFAULT_PLAY_PROGRESS,
  dailySeed,
  decodeChallenge,
  encodeChallenge,
  generateWaveSet,
  startHeat,
  type HeatState,
  type ManeuverEvent,
  type PlayProgress,
  type SimulationState,
  type WaveDefinition,
} from "@/lib/play";
import { OutsideAudio } from "./audio";
import { CanvasHost, type GameSnapshot } from "./CanvasHost";
import { HUD } from "./HUD";
import { ControlPrimer, HeatResult, JudgeCard, StartScreen } from "./Overlays";

type GameMode = "start" | "primer" | "riding" | "judge" | "result";

interface OutsideGameProps {
  challengeCode?: string;
  todaySeed?: number;
}

interface JudgeResult {
  score: number;
  wipedOut: boolean;
}

function announcerForManeuver(maneuver: ManeuverEvent): string {
  const lines: Record<ManeuverEvent["type"], string> = {
    "bottom-turn": "Set the rail. Back to work.",
    snap: "That is a proper snap.",
    air: "Upstairs — and stuck clean.",
    barrel: "Deep enough to hear the reef breathe.",
  };
  return lines[maneuver.type];
}

export function OutsideGame({
  challengeCode,
  todaySeed = dailySeed(),
}: OutsideGameProps): ReactElement {
  const challenge = useMemo(
    () => challengeCode ? decodeChallenge(challengeCode) : null,
    [challengeCode],
  );
  const initialBreakIndex = challenge?.breakIndex ?? 0;
  const initialSeed = challenge?.seed ?? todaySeed;
  const initialWaves = useMemo(
    () => generateWaveSet(initialSeed, initialBreakIndex),
    [initialBreakIndex, initialSeed],
  );
  const initialHeat = useMemo(
    () => createHeatState(initialBreakIndex, initialSeed),
    [initialBreakIndex, initialSeed],
  );
  const initialSimulation = useMemo(
    () => createSimulationState(initialWaves[0]),
    [initialWaves],
  );

  const [mode, setMode] = useState<GameMode>("start");
  const [selectedBreakIndex, setSelectedBreakIndex] = useState(initialBreakIndex);
  const [activeSeed, setActiveSeed] = useState(initialSeed);
  const [waves, setWaves] = useState<WaveDefinition[]>(initialWaves);
  const [heat, setHeat] = useState<HeatState>(initialHeat);
  const [simulation, setSimulation] = useState<SimulationState>(initialSimulation);
  const [snapshot, setSnapshot] = useState<GameSnapshot>({
    simulation: initialSimulation,
    heat: initialHeat,
    liveScore: 0,
  });
  const [judgeResult, setJudgeResult] = useState<JudgeResult>({ score: 0, wipedOut: false });
  const [announcerLine, setAnnouncerLine] = useState("Three waves. Best two count.");
  const [initials, setInitials] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [progress, setProgress] = useState<PlayProgress>({
    ...DEFAULT_PLAY_PROGRESS,
    bestHeatTotals: {},
  });
  const latestManeuverCountRef = useRef(0);
  const previousPhaseRef = useRef(initialSimulation.phase);
  const audioRef = useRef<OutsideAudio | null>(null);
  if (!audioRef.current) audioRef.current = new OutsideAudio(false);
  const audio = audioRef.current;
  const definition = BREAKS[selectedBreakIndex];

  const saveProgress = useCallback((next: PlayProgress): void => {
    setProgress(next);
    createProgressStore(window.localStorage).save(next);
  }, []);

  useEffect(() => {
    const saved = createProgressStore(window.localStorage).load();
    setProgress(saved);
    audio.setMuted(saved.muted);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = (): void => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    return (): void => media.removeEventListener("change", updateMotion);
  }, [audio]);

  useEffect(() => (): void => audio.destroy(), [audio]);

  const prepareRun = useCallback((
    breakIndex: number,
    seed: number,
    running = false,
  ): void => {
    const nextWaves = generateWaveSet(seed, breakIndex);
    const readyHeat = createHeatState(breakIndex, seed);
    const nextHeat = running ? startHeat(readyHeat) : readyHeat;
    const nextSimulation = createSimulationState(nextWaves[0]);
    setSelectedBreakIndex(breakIndex);
    setActiveSeed(seed);
    setWaves(nextWaves);
    setHeat(nextHeat);
    setSimulation(nextSimulation);
    setSnapshot({ simulation: nextSimulation, heat: nextHeat, liveScore: 0 });
    latestManeuverCountRef.current = 0;
    previousPhaseRef.current = nextSimulation.phase;
  }, []);

  const selectBreak = (breakIndex: number): void => {
    if (challenge) return;
    prepareRun(breakIndex, todaySeed);
  };

  const beginRide = (): void => {
    const runningHeat = startHeat(heat);
    setHeat(runningHeat);
    setSnapshot((current) => ({ ...current, heat: runningHeat }));
    setAnnouncerLine(
      definition.maxWaves === 1
        ? "One wave. The fifty-year swell. Do not blink."
        : "Three waves. Best two count.",
    );
    setMode("riding");
  };

  const start = async (): Promise<void> => {
    await audio.ensureStarted().catch(() => undefined);
    if (!progress.controlsSeen) {
      setMode("primer");
      return;
    }
    beginRide();
  };

  const dismissPrimer = (): void => {
    saveProgress({ ...progress, controlsSeen: true });
    beginRide();
  };

  const handleSnapshot = useCallback((next: GameSnapshot): void => {
    const maneuver = next.simulation.stats.maneuvers.at(-1);
    if (maneuver && next.simulation.stats.maneuvers.length > latestManeuverCountRef.current) {
      setAnnouncerLine(announcerForManeuver(maneuver));
      latestManeuverCountRef.current = next.simulation.stats.maneuvers.length;
    }
    if (previousPhaseRef.current !== "wipeout" && next.simulation.phase === "wipeout") {
      setAnnouncerLine("Closed out. The ocean does not care.");
    }
    previousPhaseRef.current = next.simulation.phase;
    setSnapshot(next);
  }, []);

  const persistResult = useCallback((finishedHeat: HeatState): void => {
    setProgress((current) => {
      const next: PlayProgress = {
        ...current,
        unlockedBreakIndex: finishedHeat.status === "passed"
          ? Math.min(BREAKS.length - 1, Math.max(current.unlockedBreakIndex, finishedHeat.breakIndex + 1))
          : current.unlockedBreakIndex,
        bestHeatTotals: {
          ...current.bestHeatTotals,
          [BREAKS[finishedHeat.breakIndex].beachSlug]: Math.max(
            current.bestHeatTotals[BREAKS[finishedHeat.breakIndex].beachSlug] ?? 0,
            finishedHeat.heatTotal,
          ),
        },
      };
      createProgressStore(window.localStorage).save(next);
      return next;
    });
  }, []);

  const handleWaveComplete = useCallback((
    nextHeat: HeatState,
    nextSimulation: SimulationState,
    score: number,
  ): void => {
    setHeat(nextHeat);
    setSimulation(nextSimulation);
    setJudgeResult({ score, wipedOut: nextSimulation.stats.wipeout });
    if (nextHeat.status === "passed" || nextHeat.status === "failed") persistResult(nextHeat);
    setMode("judge");
  }, [persistResult]);

  const continueAfterJudge = useCallback((): void => {
    if (heat.status === "passed" || heat.status === "failed") {
      setMode("result");
      return;
    }
    const nextWave = waves[heat.currentWaveIndex];
    const nextSimulation = createSimulationState(nextWave);
    setSimulation(nextSimulation);
    setSnapshot({ simulation: nextSimulation, heat, liveScore: 0 });
    latestManeuverCountRef.current = 0;
    previousPhaseRef.current = nextSimulation.phase;
    setAnnouncerLine(`Wave ${heat.currentWaveIndex + 1}. Put a number on it.`);
    setMode("riding");
  }, [heat, waves]);

  useEffect(() => {
    if (mode !== "judge") return;
    const timeout = window.setTimeout(continueAfterJudge, 2_500);
    return (): void => window.clearTimeout(timeout);
  }, [continueAfterJudge, mode]);

  const retry = (): void => {
    prepareRun(selectedBreakIndex, activeSeed, true);
    setAnnouncerLine("Same set. Make the adjustment.");
    setMode("riding");
  };

  const nextBreak = (): void => {
    const nextIndex = Math.min(BREAKS.length - 1, selectedBreakIndex + 1);
    prepareRun(nextIndex, todaySeed);
    setMode("start");
  };

  const toggleMute = (): void => {
    const muted = !progress.muted;
    audio.setMuted(muted);
    saveProgress({ ...progress, muted });
  };

  const resultChallengeCode = encodeChallenge({
    breakIndex: selectedBreakIndex,
    seed: activeSeed,
    heatTotal: heat.heatTotal,
    ...(initials ? { initials } : {}),
  });
  const activeWave = waves[Math.min(heat.currentWaveIndex, waves.length - 1)];

  return (
    <section className="relative isolate overflow-hidden border-4 border-[#11100D] bg-[#0D1020] shadow-lg">
      <style>{`
        @keyframes outside-card-flip {
          from { opacity: 0; transform: perspective(700px) rotateY(-78deg) scale(.92); }
          to { opacity: 1; transform: perspective(700px) rotateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="outside-card-flip"] { animation: none !important; }
        }
      `}</style>
      <CanvasHost
        key={`${selectedBreakIndex}-${activeSeed}-${heat.currentWaveIndex}`}
        definition={definition}
        wave={activeWave}
        initialSimulation={simulation}
        initialHeat={heat}
        active={mode === "riding"}
        reducedMotion={reducedMotion}
        audio={audio}
        onSnapshot={handleSnapshot}
        onWaveComplete={handleWaveComplete}
      />

      {mode === "riding" || mode === "judge" ? (
        <HUD
          definition={definition}
          snapshot={snapshot}
          ghostTotal={challenge?.breakIndex === selectedBreakIndex ? challenge.heatTotal : undefined}
          muted={progress.muted}
          announcerLine={announcerLine}
          onToggleMute={toggleMute}
        />
      ) : null}

      {mode === "start" ? (
        <StartScreen
          selectedBreakIndex={selectedBreakIndex}
          unlockedBreakIndex={progress.unlockedBreakIndex}
          challenge={challenge}
          onSelectBreak={selectBreak}
          onStart={() => void start()}
        />
      ) : null}
      {mode === "primer" ? <ControlPrimer onContinue={dismissPrimer} /> : null}
      {mode === "judge" ? (
        <JudgeCard
          score={judgeResult.score}
          wipedOut={judgeResult.wipedOut}
          isHeatOver={heat.status === "passed" || heat.status === "failed"}
          incomingWaveNumber={heat.status === "running" ? heat.currentWaveIndex + 1 : null}
          onContinue={continueAfterJudge}
        />
      ) : null}
      {mode === "result" ? (
        <HeatResult
          definition={definition}
          heat={heat}
          challenge={challenge}
          challengeCode={resultChallengeCode}
          initials={initials}
          onInitialsChange={setInitials}
          onRetry={retry}
          onNext={nextBreak}
        />
      ) : null}
    </section>
  );
}
