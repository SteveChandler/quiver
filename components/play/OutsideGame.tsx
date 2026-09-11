"use client";

import dynamic from "next/dynamic";
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
import type { GameSnapshot } from "./game-types";
import { ControlPrimer, GameOverScreen, HeatResult, JudgeCard, StartScreen, WipeoutScreen } from "./Overlays";

const PhaserHost = dynamic(() => import("./phaser/PhaserHost"), {
  ssr: false,
  loading: () => <div className="min-h-[650px] bg-[#FFBE8A]" aria-label="Loading surf" />,
});

type GameMode = "start" | "primer" | "riding" | "judge" | "gameover" | "result";

interface OutsideGameProps {
  challengeCode?: string;
  todaySeed?: number;
}

interface JudgeResult {
  score: number;
  wipedOut: boolean;
  reason: string;
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
  const [judgeResult, setJudgeResult] = useState<JudgeResult>({ score: 0, wipedOut: false, reason: "Caught by the foam" });
  const [sessionFrame, setSessionFrame] = useState<string>("");
  const [announcerLine, setAnnouncerLine] = useState("Three waves. Best two count.");
  const [initials, setInitials] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [progress, setProgress] = useState<PlayProgress>({
    ...DEFAULT_PLAY_PROGRESS,
    bestHeatTotals: {},
    bestArcadeScores: {},
  });
  const latestManeuverCountRef = useRef(0);
  const previousPhaseRef = useRef(initialSimulation.phase);
  const pendingPracticeRef = useRef(false);
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
    practice = false,
  ): void => {
    const nextWaves = generateWaveSet(seed, breakIndex);
    const readyHeat = createHeatState(breakIndex, seed, practice);
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

  const beginRide = (practice: boolean): void => {
    prepareRun(selectedBreakIndex, activeSeed, true, practice);
    setAnnouncerLine(
      practice
        ? "Practice set. No clock. Find the line."
        : definition.maxWaves === 1
        ? "One wave. The fifty-year swell. Do not blink."
        : "Three waves. Best two count.",
    );
    setMode("riding");
  };

  const start = async (practice: boolean): Promise<void> => {
    pendingPracticeRef.current = practice;
    await audio.ensureStarted().catch(() => undefined);
    if (!progress.controlsSeen) {
      setMode("primer");
      return;
    }
    beginRide(practice);
  };

  const dismissPrimer = (): void => {
    saveProgress({ ...progress, controlsSeen: true });
    beginRide(pendingPracticeRef.current);
  };

  const handleSnapshot = useCallback((next: GameSnapshot): void => {
    const maneuver = next.simulation.stats.maneuvers.at(-1);
    if (maneuver && next.simulation.stats.maneuvers.length > latestManeuverCountRef.current) {
      setAnnouncerLine(announcerForManeuver(maneuver));
      latestManeuverCountRef.current = next.simulation.stats.maneuvers.length;
    }
    if (previousPhaseRef.current !== "wipeout" && next.simulation.phase === "wipeout") {
      setAnnouncerLine(next.simulation.wipeoutReason ?? "Caught by the foam");
    }
    previousPhaseRef.current = next.simulation.phase;
    setSnapshot(next);
  }, []);

  const persistResult = useCallback((finishedHeat: HeatState): void => {
    if (finishedHeat.practice) return;
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
        bestArcadeScores: {
          ...current.bestArcadeScores,
          [BREAKS[finishedHeat.breakIndex].beachSlug]: Math.max(
            current.bestArcadeScores[BREAKS[finishedHeat.breakIndex].beachSlug] ?? 0,
            finishedHeat.arcadeScore,
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
    setJudgeResult({ score, wipedOut: nextSimulation.stats.wipeout, reason: nextSimulation.wipeoutReason ?? "Caught by the foam" });
    if (nextHeat.status === "passed" || nextHeat.status === "failed") persistResult(nextHeat);
    setMode("judge");
  }, [persistResult]);

  const continueAfterJudge = useCallback((): void => {
    if (heat.status === "failed") {
      setMode("gameover");
      return;
    }
    if (heat.status === "passed") {
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
    if (mode !== "judge" || judgeResult.wipedOut) return;
    const timeout = window.setTimeout(continueAfterJudge, 2_500);
    return (): void => window.clearTimeout(timeout);
  }, [continueAfterJudge, judgeResult.wipedOut, mode]);

  useEffect(() => {
    if (mode !== "gameover") return;
    const timeout = window.setTimeout((): void => setMode("result"), reducedMotion ? 0 : 1_000);
    return (): void => window.clearTimeout(timeout);
  }, [mode, reducedMotion]);

  const retry = (): void => {
    prepareRun(selectedBreakIndex, activeSeed, true, heat.practice);
    setAnnouncerLine("Same set. Make the adjustment.");
    setMode("riding");
  };

  const retryLastSection = (): void => {
    const waveIndex = Math.max(0, heat.currentWaveIndex - 1);
    const practiceHeat: HeatState = {
      ...startHeat(createHeatState(selectedBreakIndex, activeSeed, true)),
      currentWaveIndex: waveIndex,
      waveScores: Array(Math.max(0, definition.maxWaves - 1)).fill(0),
    };
    const nextSimulation = createSimulationState(waves[waveIndex]);
    setHeat(practiceHeat);
    setSimulation(nextSimulation);
    setSnapshot({ simulation: nextSimulation, heat: practiceHeat, liveScore: 0 });
    setAnnouncerLine("Last section. Practice pace. Find the gap.");
    latestManeuverCountRef.current = 0;
    previousPhaseRef.current = nextSimulation.phase;
    setMode("riding");
  };

  const nextBreak = (): void => {
    const nextIndex = Math.min(BREAKS.length - 1, selectedBreakIndex + 1);
    prepareRun(nextIndex, todaySeed, false, false);
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
  const displayWaveIndex = mode === "judge"
    ? Math.max(0, heat.currentWaveIndex - 1)
    : Math.min(heat.currentWaveIndex, waves.length - 1);
  const activeWave = waves[displayWaveIndex];

  return (
    <section className="one-more-wave relative isolate h-svh w-full overflow-hidden bg-[#FFBE8A] tracking-[0.04em] [font-family:var(--font-play-pixel)] [text-shadow:1px_1px_0_#0A1D2B]">
      <style>{`
        .one-more-wave, .one-more-wave * { font-family: var(--font-play-pixel) !important; }
        .one-more-wave h1, .one-more-wave h2, .one-more-wave h3 { font-family: var(--font-play-pixel) !important; }
        .one-more-wave button {
          background-image: url('/play/sprites/ui.png') !important;
          background-position: 71.23% 87.82% !important;
          background-size: 5477.78% 1796.67% !important;
          image-rendering: pixelated;
        }
        @keyframes outside-card-flip {
          from { opacity: 0; transform: perspective(700px) rotateY(-78deg) scale(.92); }
          to { opacity: 1; transform: perspective(700px) rotateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="outside-card-flip"] { animation: none !important; }
        }
      `}</style>
      <PhaserHost
        key={`${selectedBreakIndex}-${activeSeed}-${displayWaveIndex}`}
        definition={definition}
        wave={activeWave}
        initialSimulation={simulation}
        initialHeat={heat}
        active={mode === "riding"}
        reducedMotion={reducedMotion}
        muted={progress.muted}
        currentBestArcadeScore={progress.bestArcadeScores[definition.beachSlug] ?? 0}
        audio={audio}
        onToggleMute={toggleMute}
        onSnapshot={handleSnapshot}
        onFrameCapture={setSessionFrame}
        onWaveComplete={handleWaveComplete}
      />

      {mode === "start" ? (
        <StartScreen
          selectedBreakIndex={selectedBreakIndex}
          unlockedBreakIndex={progress.unlockedBreakIndex}
          challenge={challenge}
          challengeCode={encodeChallenge({
            breakIndex: selectedBreakIndex,
            seed: activeSeed,
            heatTotal: 0,
          })}
          onSelectBreak={selectBreak}
          onStart={() => void start(false)}
          onPractice={() => void start(true)}
        />
      ) : null}
      {mode === "primer" ? <ControlPrimer onContinue={dismissPrimer} /> : null}
      {mode === "judge" && judgeResult.wipedOut ? (
        <WipeoutScreen
          definition={definition}
          reason={judgeResult.reason}
          heatTotal={heat.heatTotal}
          challengeCode={resultChallengeCode}
          isHeatOver={heat.status === "passed" || heat.status === "failed"}
          onRetry={retry}
          onLastSection={retryLastSection}
          onResult={continueAfterJudge}
        />
      ) : null}
      {mode === "judge" && !judgeResult.wipedOut ? (
        <JudgeCard
          score={judgeResult.score}
          wipedOut={judgeResult.wipedOut}
          practice={heat.practice}
          isHeatOver={heat.status === "passed" || heat.status === "failed"}
          incomingWaveNumber={heat.status === "running" ? heat.currentWaveIndex + 1 : null}
          onContinue={continueAfterJudge}
        />
      ) : null}
      {mode === "gameover" ? <GameOverScreen /> : null}
      {mode === "result" ? (
        <HeatResult
          definition={definition}
          heat={heat}
          challenge={challenge}
          challengeCode={resultChallengeCode}
          initials={initials}
          bestScore={progress.bestHeatTotals[definition.beachSlug] ?? 0}
          sessionFrame={sessionFrame}
          onInitialsChange={setInitials}
          onRetry={retry}
          onNext={nextBreak}
        />
      ) : null}
    </section>
  );
}
