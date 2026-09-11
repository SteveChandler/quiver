import Phaser from "phaser";

import {
  completeWave,
  FIXED_TIMESTEP_SECONDS,
  getLiveWaveScore,
  judgeWave,
  stepSimulation,
  tickHeat,
  type HeatState,
  type ManeuverEvent,
  type SimulationInput,
  type SimulationState,
} from "@/lib/play";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";
import { PLAY_PALETTE } from "./pixel-sprites";
import type { AtlasOverride, PhaserBridgeRef } from "./types";

const colour = (value: string): number => Phaser.Display.Color.HexStringToColor(value).color;

const C = {
  deepBlue: colour(PLAY_PALETTE.deepBlue),
  oceanBlue: colour(PLAY_PALETTE.oceanBlue),
  cyan: colour(PLAY_PALETTE.cyan),
  mint: colour(PLAY_PALETTE.mint),
  sky: colour(PLAY_PALETTE.sky),
  trough: colour(PLAY_PALETTE.trough),
  pocket: colour(PLAY_PALETTE.pocket),
  face: colour(PLAY_PALETTE.face),
  sunlit: colour(PLAY_PALETTE.sunlit),
  glow: colour(PLAY_PALETTE.glow),
  foam: colour(PLAY_PALETTE.foam),
  foamCool: colour(PLAY_PALETTE.foamCool),
  foamShadow: colour(PLAY_PALETTE.foamShadow),
  foamBlue: colour(PLAY_PALETTE.foamBlue),
  sun: colour(PLAY_PALETTE.sun),
  peach: colour(PLAY_PALETTE.peach),
  coral: colour(PLAY_PALETTE.coral),
  pink: colour(PLAY_PALETTE.pink),
  lavender: colour(PLAY_PALETTE.lavender),
  yellow: colour(PLAY_PALETTE.yellow),
  hotCoral: colour(PLAY_PALETTE.hotCoral),
  wipeout: colour(PLAY_PALETTE.wipeout),
  navy: colour(PLAY_PALETTE.navy),
  shadow: colour(PLAY_PALETTE.shadow),
  wood: colour(PLAY_PALETTE.wood),
  woodDark: colour(PLAY_PALETTE.woodDark),
} as const;

const IDLE_INPUT: SimulationInput = {
  vertical: 0,
  action: false,
  actionPressed: false,
  actionReleased: false,
};

const RIDER_FRAMES = {
  idle: ["surfer-idle-0", "surfer-idle-1"],
  pump: ["surfer-pump-0", "surfer-pump-1", "surfer-pump-2", "surfer-pump-3"],
  low: ["surfer-low-0", "surfer-low-1"],
  bottomTurn: ["surfer-bottom-turn-0", "surfer-bottom-turn-1", "surfer-bottom-turn-2"],
  topTurn: ["surfer-top-turn-0", "surfer-top-turn-1", "surfer-top-turn-2"],
  cutbackInit: ["surfer-cutback-init-0", "surfer-cutback-init-1"],
  cutback: ["surfer-cutback-rebound-0", "surfer-cutback-rebound-1"],
  barrel: ["surfer-barrel-0", "surfer-barrel-1"],
  takeoff: ["surfer-air-takeoff-0", "surfer-air-takeoff-1"],
  air: ["surfer-air-straight-0", "surfer-air-straight-1"],
  grab: ["surfer-air-grab-0", "surfer-air-grab-1"],
  landing: ["surfer-landing-0", "surfer-landing-1"],
  wobble: ["surfer-wobble-0", "surfer-wobble-1"],
  wipeout: ["surfer-wipeout-0", "surfer-wipeout-1", "surfer-wipeout-2", "surfer-wipeout-3"],
} as const;

export class PlayScene extends Phaser.Scene {
  private bridgeRef!: PhaserBridgeRef;
  private simulation!: SimulationState;
  private previousSimulation!: SimulationState;
  private heat!: HeatState;
  private world!: Phaser.GameObjects.Graphics;
  private wave!: Phaser.GameObjects.Graphics;
  private riderRig!: Phaser.GameObjects.Container;
  private rider!: Phaser.GameObjects.Image;
  private board!: Phaser.GameObjects.Image;
  private looseBoard!: Phaser.GameObjects.Image;
  private wake!: Phaser.GameObjects.Image;
  private spray!: Phaser.GameObjects.Image;
  private sun!: Phaser.GameObjects.Image;
  private clouds: Phaser.GameObjects.Image[] = [];
  private mountains: Phaser.GameObjects.Image[] = [];
  private palms: Phaser.GameObjects.Image[] = [];
  private gulls: Phaser.GameObjects.Image[] = [];
  private foam: Phaser.GameObjects.Image[] = [];
  private sparkles: Phaser.GameObjects.Image[] = [];
  private pier: Phaser.GameObjects.Image[] = [];
  private overrides: Record<string, AtlasOverride> = {};
  private inputState: SimulationInput = { ...IDLE_INPUT };
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private pointerSide: "left" | "right" | null = null;
  private pointerY = 0;
  private accumulator = 0;
  private ambientElapsed = 0;
  private frame = 0;
  private lastManeuverCount = 0;
  private previousPhase: SimulationState["phase"] = "riding";
  private currentRiderKey = "";
  private riderAngle = 0;
  private riderDirection: 1 | -1 = 1;
  private finished = false;
  private wasActive = false;

  constructor() {
    super("play");
  }

  create(): void {
    this.bridgeRef = this.registry.get("bridge") as PhaserBridgeRef;
    this.overrides = this.registry.get("sprite-overrides") as Record<string, AtlasOverride>;
    this.simulation = this.bridgeRef.current.initialSimulation;
    this.previousSimulation = this.simulation;
    this.heat = this.bridgeRef.current.initialHeat;

    this.world = this.add.graphics().setDepth(0);
    this.wave = this.add.graphics().setDepth(2);
    this.sun = this.add.image(376, 47, "sun").setScale(5).setDepth(1);
    this.clouds = [
      this.add.image(80, 42, "cloud"),
      this.add.image(245, 65, "cloud"),
      this.add.image(438, 32, "cloud"),
    ];
    this.mountains = [
      this.add.image(64, 106, "mountain"),
      this.add.image(218, 105, "mountain"),
      this.add.image(385, 107, "mountain"),
    ];
    this.palms = [
      this.add.image(25, 105, "palm"),
      this.add.image(49, 108, "palm"),
      this.add.image(432, 108, "palm"),
    ];
    this.gulls = [
      this.add.image(95, 62, "seagull-0"),
      this.add.image(145, 45, "seagull-1"),
      this.add.image(330, 76, "seagull-0"),
    ];
    this.foam = [
      this.add.image(0, 0, "foam-chunk"),
      this.add.image(0, 0, "foam-chunk"),
      this.add.image(0, 0, "foam-chunk"),
      this.add.image(0, 0, "foam-chunk"),
    ];
    this.sparkles = Array.from({ length: 8 }, () => this.add.image(0, 0, "sparkle"));
    this.pier = [
      this.add.image(430, 169, "pier-post"),
      this.add.image(457, 169, "pier-post"),
      this.add.image(444, 143, "pier-brace"),
    ];
    this.wake = this.add.image(182, 214, "wake-streak").setOrigin(1, 0.5).setDepth(4);
    this.spray = this.add.image(205, 190, "spray-burst").setDepth(4);
    this.board = this.add.image(0, 0, "surfboard").setScale(1.8);
    this.rider = this.add.image(0, -4, "surfer-idle-0").setOrigin(0.5, 1).setScale(1.8);
    this.riderRig = this.add.container(205, 190, [this.board, this.rider]).setDepth(6);
    this.looseBoard = this.add.image(220, 202, "surfboard").setScale(1.8).setDepth(6);
    this.configureScenery();
    this.configureInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, (): void => this.removeInput());
    this.renderWorld(0);
  }

  update(_: number, delta: number): void {
    const bridge = this.bridgeRef.current;
    this.ambientElapsed += Math.min(delta, 100) / 1_000;
    if (bridge.active && !this.wasActive) this.startActiveRide();
    this.wasActive = bridge.active;

    if (!bridge.active || this.finished) {
      this.renderWorld(0);
      return;
    }

    this.accumulator += Math.min(delta, 100) / 1_000;
    while (this.accumulator >= FIXED_TIMESTEP_SECONDS && !this.finished) {
      this.stepEngine();
      this.accumulator -= FIXED_TIMESTEP_SECONDS;
    }
    this.renderWorld(this.accumulator / FIXED_TIMESTEP_SECONDS);
  }

  private configureScenery(): void {
    for (const cloud of this.clouds) cloud.setScale(2.5).setAlpha(0.78).setDepth(1);
    for (const mountain of this.mountains) mountain.setScale(5, 3).setAlpha(0.76).setDepth(1);
    for (const palm of this.palms) palm.setScale(2.7).setAlpha(0.85).setDepth(1);
    for (const gull of this.gulls) gull.setScale(1.3).setDepth(2);
    for (const chunk of this.foam) chunk.setScale(2.2).setDepth(3);
    for (const sparkle of this.sparkles) sparkle.setScale(0.7).setDepth(3);
    for (const item of this.pier) item.setScale(3).setDepth(5);
  }

  private configureInput(): void {
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      keyboard.on("keydown-SPACE", this.onActionDown, this);
      keyboard.on("keyup-SPACE", this.onActionUp, this);
    }
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
  }

  private removeInput(): void {
    this.input.keyboard?.off("keydown-SPACE", this.onActionDown, this);
    this.input.keyboard?.off("keyup-SPACE", this.onActionUp, this);
    this.input.off("pointerdown", this.onPointerDown, this);
    this.input.off("pointermove", this.onPointerMove, this);
    this.input.off("pointerup", this.onPointerUp, this);
    this.input.off("pointerupoutside", this.onPointerUp, this);
  }

  private onActionDown(): void {
    if (!this.bridgeRef.current.active || this.inputState.action) return;
    this.inputState.action = true;
    this.inputState.actionPressed = true;
  }

  private onActionUp(): void {
    if (!this.bridgeRef.current.active || !this.inputState.action) return;
    this.inputState.action = false;
    this.inputState.actionReleased = true;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.bridgeRef.current.active) return;
    this.pointerSide = pointer.x < GAME_WIDTH / 2 ? "left" : "right";
    this.pointerY = pointer.y;
    if (this.pointerSide === "right") this.onActionDown();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown || this.pointerSide !== "left") return;
    const delta = this.pointerY - pointer.y;
    this.inputState.vertical = delta > 2 ? 1 : delta < -2 ? -1 : 0;
    this.pointerY = pointer.y;
  }

  private onPointerUp(): void {
    if (this.pointerSide === "right") this.onActionUp();
    this.inputState.vertical = 0;
    this.pointerSide = null;
  }

  private startActiveRide(): void {
    const bridge = this.bridgeRef.current;
    this.simulation = bridge.initialSimulation;
    this.previousSimulation = this.simulation;
    this.heat = bridge.initialHeat;
    this.inputState.vertical = 0;
    this.inputState.action = false;
    this.inputState.actionPressed = false;
    this.inputState.actionReleased = false;
    this.accumulator = 0;
    this.frame = 0;
    this.lastManeuverCount = this.simulation.stats.maneuvers.length;
    this.previousPhase = this.simulation.phase;
    this.finished = false;
  }

  private stepEngine(): void {
    const bridge = this.bridgeRef.current;
    if (this.pointerSide !== "left") {
      this.inputState.vertical = this.cursors?.up.isDown
        ? 1
        : this.cursors?.down.isDown ? -1 : 0;
    }
    this.previousSimulation = this.simulation;
    this.simulation = stepSimulation(
      this.simulation,
      this.inputState,
      bridge.definition,
      bridge.wave,
    );
    this.inputState.actionPressed = false;
    this.inputState.actionReleased = false;

    if (!this.heat.practice && this.heat.secondsRemaining <= FIXED_TIMESTEP_SECONDS) {
      this.heat = { ...this.heat, secondsRemaining: 0 };
      this.finishWave();
      return;
    }
    this.heat = tickHeat(this.heat, FIXED_TIMESTEP_SECONDS);

    if (this.simulation.pumping && this.frame % 12 === 0) bridge.audio.pump();
    if (this.simulation.stats.maneuvers.length > this.lastManeuverCount) {
      const maneuver = this.simulation.stats.maneuvers.at(-1);
      if (maneuver) {
        bridge.audio.maneuver(maneuver.type);
        this.showManeuverPopup(maneuver);
      }
      this.lastManeuverCount = this.simulation.stats.maneuvers.length;
    }
    if (this.previousPhase !== "wipeout" && this.simulation.phase === "wipeout") {
      bridge.audio.wipeout();
      this.showPopup("WIPEOUT", PLAY_PALETTE.wipeout);
    }
    if (this.previousPhase === "wipeout" && this.simulation.phase === "complete") {
      bridge.audio.gasp();
    }
    this.previousPhase = this.simulation.phase;
    this.frame += 1;

    if (this.frame % 6 === 0) {
      bridge.onSnapshot({
        simulation: this.simulation,
        heat: this.heat,
        liveScore: getLiveWaveScore(this.simulation),
      });
    }
    if (this.simulation.phase === "complete") this.finishWave();
  }

  private finishWave(): void {
    if (this.finished) return;
    this.finished = true;
    const score = judgeWave(this.simulation.stats).score;
    this.heat = completeWave(this.heat, score, this.simulation.stats.wipeout, this.simulation.stats);
    const bridge = this.bridgeRef.current;
    bridge.onSnapshot({ simulation: this.simulation, heat: this.heat, liveScore: score });
    bridge.onWaveComplete(this.heat, this.simulation, score);
  }

  private renderWorld(interpolation: number): void {
    const bridge = this.bridgeRef.current;
    const active = bridge.active;
    const state = this.simulation;
    const elapsed = active ? state.elapsed : this.ambientElapsed;
    const motionElapsed = bridge.reducedMotion ? 0 : elapsed;
    const facePosition = active
      ? Phaser.Math.Linear(this.previousSimulation.facePosition, state.facePosition, interpolation)
      : 0.68 + Math.sin(elapsed * 1.8) * 0.025;
    const sectionDistance = active
      ? Phaser.Math.Linear(this.previousSimulation.sectionDistance, state.sectionDistance, interpolation)
      : 0.82;
    const riderX = 205;
    const faceTop = 104 - bridge.definition.index * 3;
    const riderY = state.inBarrel ? faceTop + 101 : 246 - facePosition * (225 - faceTop);
    const airProgress = state.phase === "airborne"
      ? Phaser.Math.Clamp(state.phaseElapsed / 0.31, 0, 1)
      : 0;
    const airLift = state.phase === "airborne" ? Math.sin(airProgress * Math.PI) * 44 : 0;
    const sectionX = riderX - sectionDistance * 112;
    const throwing = this.isThrowing(state.elapsed) || (!active && bridge.definition.index >= 4);
    const foamPressure = Phaser.Math.Clamp((38 - state.speed) / 38, 0, 1);
    const launchZone = state.phase === "airborne" || (facePosition >= 0.82 && state.speed >= 55);

    this.drawSky(motionElapsed);
    this.drawWave(faceTop, sectionX, throwing, motionElapsed, foamPressure, launchZone);
    this.positionScenery(motionElapsed, active, sectionX, foamPressure);
    this.positionRider(facePosition, riderX, riderY - airLift, elapsed);
    this.positionEffects(riderX, riderY - airLift, sectionX, motionElapsed, throwing);
  }

  private drawSky(elapsed: number): void {
    const graphics = this.world;
    graphics.clear();
    graphics.fillStyle(C.lavender).fillRect(0, 0, GAME_WIDTH, 36);
    graphics.fillStyle(C.pink).fillRect(0, 36, GAME_WIDTH, 34);
    graphics.fillStyle(C.coral).fillRect(0, 70, GAME_WIDTH, 28);
    graphics.fillStyle(C.peach).fillRect(0, 98, GAME_WIDTH, 30);
    graphics.fillStyle(C.sun).fillRect(0, 124, GAME_WIDTH, 9);

    const coastShift = Math.round((elapsed * 2) % 24);
    graphics.fillStyle(C.lavender, 0.85).beginPath().moveTo(0, 111);
    for (let x = -24; x <= GAME_WIDTH + 24; x += 24) {
      const step = ((x / 24 + coastShift / 8) % 4 + 4) % 4;
      graphics.lineTo(x - coastShift, 105 + step * 3);
      graphics.lineTo(x + 12 - coastShift, 105 + step * 3);
    }
    graphics.lineTo(GAME_WIDTH, 132).lineTo(0, 132).closePath().fillPath();
    graphics.fillStyle(C.navy, 0.75).fillRect(0, 122, GAME_WIDTH, 6);
  }

  private drawWave(
    faceTop: number,
    sectionX: number,
    throwing: boolean,
    elapsed: number,
    foamPressure: number,
    launchZone: boolean,
  ): void {
    const graphics = this.wave;
    graphics.clear();
    graphics.fillStyle(C.trough).fillRect(0, 126, GAME_WIDTH, GAME_HEIGHT - 126);
    this.fillFaceBand(C.pocket, faceTop, 54);
    this.fillFaceBand(C.face, faceTop, 36);
    this.fillFaceBand(C.sunlit, faceTop, 19);
    this.fillFaceBand(C.glow, faceTop, 7);
    graphics.fillStyle(C.trough).fillRect(0, 236, GAME_WIDTH, GAME_HEIGHT - 236);

    this.strokeCrest(C.sunlit, 10, faceTop, 2);
    this.strokeCrest(C.glow, 6, faceTop, 2);
    this.strokeCrest(C.foam, 2, faceTop, 2);
    this.strokeCrest(C.foamShadow, 2, faceTop, 16);

    if (launchZone) this.drawLaunchZone(faceTop, elapsed);

    if (throwing) this.drawBarrel(faceTop, elapsed);
    this.drawWhitewater(sectionX, faceTop, elapsed, foamPressure);
  }

  private fillFaceBand(fill: number, faceTop: number, offset: number): void {
    const graphics = this.wave;
    graphics.fillStyle(fill).beginPath();
    graphics.moveTo(0, faceTop + 54 + offset);
    graphics.lineTo(92, faceTop + 38 + offset);
    graphics.lineTo(116, faceTop + 18 + offset);
    graphics.lineTo(137, faceTop + 4 + offset);
    graphics.lineTo(158, faceTop + offset);
    graphics.lineTo(184, faceTop + 3 + offset);
    graphics.lineTo(208, faceTop + 17 + offset);
    graphics.lineTo(250, faceTop + 25 + offset);
    graphics.lineTo(325, faceTop + 37 + offset);
    graphics.lineTo(405, faceTop + 39 + offset);
    graphics.lineTo(GAME_WIDTH, faceTop + 44 + offset);
    graphics.lineTo(GAME_WIDTH, GAME_HEIGHT).lineTo(0, GAME_HEIGHT);
    graphics.closePath().fillPath();
  }

  private strokeCrest(fill: number, width: number, faceTop: number, offset: number): void {
    const graphics = this.wave;
    graphics.lineStyle(width, fill).beginPath();
    graphics.moveTo(0, faceTop + 54 + offset);
    graphics.lineTo(92, faceTop + 38 + offset);
    graphics.lineTo(116, faceTop + 18 + offset);
    graphics.lineTo(137, faceTop + 4 + offset);
    graphics.lineTo(158, faceTop + offset);
    graphics.lineTo(184, faceTop + 3 + offset);
    graphics.lineTo(208, faceTop + 17 + offset);
    graphics.lineTo(250, faceTop + 25 + offset);
    graphics.lineTo(325, faceTop + 37 + offset);
    graphics.lineTo(405, faceTop + 39 + offset);
    graphics.lineTo(GAME_WIDTH, faceTop + 44 + offset);
    graphics.strokePath();
  }

  private drawBarrel(faceTop: number, elapsed: number): void {
    const graphics = this.wave;
    graphics.fillStyle(C.shadow, 0.88).beginPath();
    graphics.moveTo(150, faceTop + 12);
    graphics.lineTo(166, faceTop + 4).lineTo(185, faceTop).lineTo(207, faceTop + 4);
    graphics.lineTo(228, faceTop + 14).lineTo(245, faceTop + 32).lineTo(254, faceTop + 58);
    graphics.lineTo(258, faceTop + 83).lineTo(252, faceTop + 102).lineTo(238, faceTop + 116);
    graphics.lineTo(216, faceTop + 125).lineTo(188, faceTop + 128);
    graphics.lineTo(151, faceTop + 124).closePath().fillPath();
    graphics.fillStyle(C.trough, 0.94).beginPath();
    graphics.moveTo(165, faceTop + 21);
    graphics.lineTo(194, faceTop + 13).lineTo(221, faceTop + 25).lineTo(239, faceTop + 59);
    graphics.lineTo(239, faceTop + 80).lineTo(222, faceTop + 99).lineTo(190, faceTop + 107);
    graphics.lineTo(164, faceTop + 107).closePath().fillPath();
    graphics.lineStyle(8, C.sunlit).beginPath();
    graphics.moveTo(151, faceTop + 12).lineTo(178, faceTop + 2).lineTo(207, faceTop + 4).lineTo(236, faceTop + 21).lineTo(254, faceTop + 61).strokePath();
    graphics.lineStyle(3, C.foam).beginPath();
    graphics.moveTo(149, faceTop + 10).lineTo(178, faceTop).lineTo(209, faceTop + 2).lineTo(240, faceTop + 20).lineTo(257, faceTop + 63).strokePath();
    graphics.lineStyle(2, C.glow, 0.8).beginPath();
    graphics.moveTo(174, faceTop + 91).lineTo(205, faceTop + 82).lineTo(239, faceTop + 87 + Math.sin(elapsed * 4) * 2).strokePath();
    graphics.lineStyle(1, C.mint, 0.65);
    for (let index = 0; index < 4; index += 1) {
      graphics.beginPath().moveTo(174, faceTop + 44 + index * 12).lineTo(218 + index * 5, faceTop + 42 + index * 11).strokePath();
    }
    for (let index = 0; index < 7; index += 1) {
      const fall = (index * 19 + elapsed * 34) % 58;
      graphics.fillStyle(index % 2 === 0 ? C.foam : C.foamShadow)
        .fillCircle(249 + (index % 3) * 4, faceTop + 23 + fall, index % 3 === 0 ? 2 : 1);
    }
  }

  private drawLaunchZone(faceTop: number, elapsed: number): void {
    const graphics = this.wave;
    graphics.lineStyle(7, C.foam).beginPath();
    graphics.moveTo(196, faceTop + 10).lineTo(219, faceTop + 18).lineTo(250, faceTop + 27).strokePath();
    graphics.lineStyle(3, C.yellow).beginPath();
    graphics.moveTo(203, faceTop + 9).lineTo(224, faceTop + 17).lineTo(246, faceTop + 24).strokePath();
    for (let index = 0; index < 6; index += 1) {
      const sprayY = faceTop + 4 - ((index * 11 + elapsed * 22) % 19);
      graphics.fillStyle(index % 2 === 0 ? C.foam : C.glow)
        .fillRect(207 + index * 8, sprayY, index % 3 === 0 ? 3 : 2, index % 2 === 0 ? 3 : 2);
    }
  }

  private drawWhitewater(
    sectionX: number,
    faceTop: number,
    elapsed: number,
    pressure: number,
  ): void {
    const graphics = this.wave;
    const edge = Math.round(sectionX);
    const lean = Math.round(8 + pressure * 15);
    const churn = Math.floor(elapsed * (16 + pressure * 18));
    graphics.fillStyle(C.foamShadow).beginPath();
    graphics.moveTo(0, faceTop + 7);
    for (let x = 0; x < edge; x += 12) {
      graphics.lineTo(x, faceTop + 7 - Math.abs(Math.sin(x * 0.17 + elapsed * 5)) * 6);
    }
    graphics.lineTo(edge + lean, faceTop + 7);
    graphics.lineTo(edge + lean + 5, faceTop + 30).lineTo(edge + 7, faceTop + 58).lineTo(edge, faceTop + 84);
    graphics.lineTo(edge - 5, faceTop + 112).lineTo(edge + 4, faceTop + 140).lineTo(edge - 3, GAME_HEIGHT);
    graphics.lineTo(0, GAME_HEIGHT).closePath().fillPath();

    for (let index = 0; index < 30; index += 1) {
      if (pressure < 0.4 && index % 4 === 0) continue;
      const width = 3 + (index % 4) * 2;
      const xRange = Math.max(24, edge - 8);
      const x = 2 + ((index * 37 + churn * (1 + index % 3)) % xRange);
      const y = faceTop + 18 + ((index * 29 + churn * 2) % Math.max(30, GAME_HEIGHT - faceTop - 24));
      const value = index % 4;
      const fill = value === 0 ? C.foam : value === 1 ? C.foamCool : value === 2 ? C.foamShadow : C.foamBlue;
      graphics.fillStyle(fill).fillRect(x, y, width, value === 3 ? 2 : 3);
    }
    for (let index = 0; index < 9; index += 1) {
      const x = 7 + ((index * 31 + churn * (1 + index % 2)) % Math.max(28, edge - 12));
      const y = faceTop + 27 + ((index * 41 + churn) % Math.max(34, GAME_HEIGHT - faceTop - 42));
      graphics.fillStyle(index % 3 === 0 ? C.foam : C.foamCool)
        .fillCircle(x, y, 4 + index % 4);
      graphics.fillStyle(index % 2 === 0 ? C.foamBlue : C.foamShadow)
        .fillRect(x - 8, y + 5, 13 + index % 3 * 5, 2);
    }

    graphics.lineStyle(5, C.foam).beginPath();
    graphics.moveTo(edge + lean, faceTop + 7);
    graphics.lineTo(edge + lean + 5, faceTop + 30).lineTo(edge + 7, faceTop + 58).lineTo(edge, faceTop + 84);
    graphics.lineTo(edge - 5, faceTop + 112).lineTo(edge + 4, faceTop + 140).lineTo(edge - 3, GAME_HEIGHT);
    graphics.strokePath();
    graphics.lineStyle(2, C.foamBlue).beginPath();
    graphics.moveTo(edge + lean - 7, faceTop + 16);
    graphics.lineTo(edge + lean - 1, faceTop + 41).lineTo(edge - 4, faceTop + 67).lineTo(edge - 7, faceTop + 89);
    graphics.lineTo(edge - 12, faceTop + 116).lineTo(edge - 4, faceTop + 145).lineTo(edge - 10, GAME_HEIGHT);
    graphics.strokePath();

    for (let index = 0; index < 8; index += 1) {
      const y = faceTop + 30 + index * 25;
      const bulge = Math.sin(index * 2.3 + elapsed * (4 + pressure * 4)) * 5;
      graphics.fillStyle(index % 3 === 0 ? C.foam : C.foamCool)
        .fillCircle(edge + bulge, y, 4 + index % 3);
    }

    const crownCount = 8 + Math.round(pressure * 5);
    for (let index = 0; index < crownCount; index += 1) {
      const x = edge + lean - index * 9;
      const y = faceTop + 8 - Math.abs(Math.sin(index * 1.7 + elapsed * (5 + pressure * 5))) * (7 + pressure * 6);
      graphics.fillStyle(index % 3 === 0 ? C.foamShadow : C.foam)
        .fillCircle(x, y, 2 + index % 3);
    }
  }

  private positionScenery(
    elapsed: number,
    active: boolean,
    sectionX: number,
    foamPressure: number,
  ): void {
    this.sun.setPosition(376 - (elapsed * 0.35) % 20, 47);
    for (let index = 0; index < this.clouds.length; index += 1) {
      const cloud = this.clouds[index];
      cloud.x = Phaser.Math.Wrap(75 + index * 175 - elapsed * (2 + index), -45, 525);
    }
    for (let index = 0; index < this.mountains.length; index += 1) {
      this.mountains[index].x = Phaser.Math.Wrap(62 + index * 162 - elapsed * 1.1, -75, 555);
    }
    for (let index = 0; index < this.palms.length; index += 1) {
      this.palms[index].x = Phaser.Math.Wrap(24 + index * 205 - elapsed * 2.2, -20, 510);
    }
    for (let index = 0; index < this.gulls.length; index += 1) {
      const gull = this.gulls[index];
      gull.x = Phaser.Math.Wrap(90 + index * 130 - elapsed * (5 + index), -20, 510);
      if (Math.floor(elapsed * 5 + index) % 2 === 0) this.applyTexture(gull, "seagull-0");
      else this.applyTexture(gull, "seagull-1");
    }

    const pierProgress = active
      ? Phaser.Math.Clamp(this.simulation.elapsed / this.bridgeRef.current.wave.duration, 0, 1)
      : 0.86;
    const pierX = active ? 590 - pierProgress * 170 : 392;
    const pierScale = active ? 3 : 2;
    this.pier[0].setPosition(pierX, active ? 187 : 151).setScale(pierScale).setVisible(pierProgress > 0.58);
    this.pier[1].setPosition(pierX + 30, active ? 187 : 151).setScale(pierScale).setVisible(pierProgress > 0.58);
    this.pier[2].setPosition(pierX + 15, active ? 157 : 132).setScale(pierScale).setVisible(pierProgress > 0.58);

    for (let index = 0; index < this.foam.length; index += 1) {
      const drift = (elapsed * (5 + foamPressure * 8) + index * 19) % 58;
      this.foam[index]
        .setPosition(sectionX + 9 + drift, 137 + index * 28 + Math.sin(elapsed * 5 + index) * 5)
        .setScale(1.2 + foamPressure * 0.7)
        .setAlpha(0.72 + foamPressure * 0.22);
    }
  }

  private positionRider(
    facePosition: number,
    riderX: number,
    riderY: number,
    elapsed: number,
  ): void {
    const key = this.getRiderKey(elapsed, facePosition);
    if (key !== this.currentRiderKey) {
      this.applyTexture(this.rider, key);
      this.currentRiderKey = key;
    }
    const wipeout = this.simulation.phase === "wipeout";
    this.riderDirection = this.isCutback(elapsed) ? -1 : 1;
    this.riderAngle = this.getRiderAngle(facePosition, elapsed);
    const joinedAirFrame = key.includes("air-") || key.startsWith("surfer-landing");
    this.riderRig
      .setPosition(riderX, riderY)
      .setAngle(wipeout ? this.simulation.phaseElapsed * 240 : this.riderAngle)
      .setScale(this.riderDirection, 1);
    this.rider.setY(joinedAirFrame ? 4 : -4);
    this.rider.setScale(1.8, this.simulation.inBarrel ? 1.5 : 1.8);
    this.board.setVisible(!wipeout && !joinedAirFrame);
    this.looseBoard
      .setVisible(wipeout)
      .setPosition(riderX + 35 + this.simulation.phaseElapsed * 10, riderY + 14)
      .setAngle(-18 - this.simulation.phaseElapsed * 95);
  }

  private getRiderAngle(facePosition: number, elapsed: number): number {
    const state = this.simulation;
    if (state.phase === "airborne") {
      const progress = Phaser.Math.Clamp(state.phaseElapsed / 0.31, 0, 1);
      return -19 + progress * 34;
    }
    if (state.inBarrel) return -5;

    const maneuver = state.stats.maneuvers.at(-1);
    const age = maneuver ? elapsed - maneuver.at : 99;
    if (maneuver?.type === "bottom-turn" && age < 0.55) return -20 + age * 18;
    if (maneuver?.type === "snap" && age < 0.55) return this.isCutback(elapsed) ? -14 : 18 - age * 14;
    return (facePosition - 0.45) * 20;
  }

  private isCutback(elapsed: number): boolean {
    const maneuvers = this.simulation.stats.maneuvers;
    const maneuver = maneuvers.at(-1);
    if (maneuver?.type !== "snap" || elapsed - maneuver.at >= 0.55) return false;
    return maneuvers.at(-2)?.type === "snap";
  }

  private getRiderKey(elapsed: number, facePosition: number): string {
    const state = this.simulation;
    if (state.phase === "wipeout") return RIDER_FRAMES.wipeout[Math.floor(state.phaseElapsed * 5) % 4];
    if (state.phase === "airborne") {
      if (state.phaseElapsed < 0.09) return RIDER_FRAMES.takeoff[this.frame % 2];
      return this.inputState.action
        ? RIDER_FRAMES.grab[this.frame % 2]
        : RIDER_FRAMES.air[this.frame % 2];
    }
    if (state.inBarrel) return RIDER_FRAMES.barrel[Math.floor(elapsed * 6) % 2];

    const maneuver = state.stats.maneuvers.at(-1);
    const age = maneuver ? state.elapsed - maneuver.at : 99;
    if (maneuver?.type === "air" && age < 0.45) return RIDER_FRAMES.landing[Math.floor(age * 8) % 2];
    if (maneuver?.type === "snap" && age < 0.55) {
      const previous = state.stats.maneuvers.at(-2);
      if (previous?.type === "snap") {
        if (age < 0.28) return RIDER_FRAMES.cutbackInit[Math.min(1, Math.floor(age * 7))];
        return RIDER_FRAMES.cutback[Math.min(1, Math.floor((age - 0.28) * 7))];
      }
      return RIDER_FRAMES.topTurn[Math.min(2, Math.floor(age * 6))];
    }
    if (maneuver?.type === "bottom-turn" && age < 0.55) {
      return RIDER_FRAMES.bottomTurn[Math.min(2, Math.floor(age * 6))];
    }
    if (state.speed < 12) return RIDER_FRAMES.wobble[Math.floor(elapsed * 5) % 2];
    if (state.pumping) return RIDER_FRAMES.pump[Math.floor(elapsed * 8) % 4];
    if (facePosition < 0.3) return RIDER_FRAMES.low[Math.floor(elapsed * 4) % 2];
    return RIDER_FRAMES.idle[Math.floor(elapsed * 3) % 2];
  }

  private positionEffects(
    riderX: number,
    riderY: number,
    sectionX: number,
    elapsed: number,
    throwing: boolean,
  ): void {
    const speedAlpha = Phaser.Math.Clamp((this.simulation.speed - 25) / 45, 0, 1);
    const angle = Phaser.Math.DegToRad(this.riderAngle);
    const tailDistance = 19 * this.riderDirection;
    const tailX = riderX - Math.cos(angle) * tailDistance;
    const tailY = riderY - Math.sin(angle) * tailDistance + 2;
    const wipeout = this.simulation.phase === "wipeout";
    this.wake
      .setPosition(tailX, tailY)
      .setAngle(this.riderAngle)
      .setScale((1.5 + speedAlpha) * this.riderDirection, 1.5 + speedAlpha)
      .setAlpha(wipeout ? 0 : 0.4 + speedAlpha * 0.6);
    const launch = this.simulation.phase === "airborne" && this.simulation.phaseElapsed < 0.16;
    const recent = this.simulation.stats.maneuvers.at(-1);
    const maneuverSpray = recent ? this.simulation.elapsed - recent.at < 0.4 : false;
    this.spray
      .setPosition(tailX, tailY - 3)
      .setAngle(this.riderAngle)
      .setScale((launch ? 2.8 : 2) * this.riderDirection, launch ? 2.8 : 2)
      .setVisible(!wipeout && (launch || maneuverSpray || throwing));

    for (let index = 0; index < this.sparkles.length; index += 1) {
      const sparkle = this.sparkles[index];
      sparkle.x = Phaser.Math.Wrap(index * 71 - elapsed * (12 + index), 0, GAME_WIDTH);
      sparkle.y = 150 + (index % 4) * 27;
      sparkle
        .setAlpha(0.35 + (index % 3) * 0.2)
        .setVisible(!this.bridgeRef.current.reducedMotion || index < 3);
    }
    if (sectionX > riderX - 24 && !this.bridgeRef.current.reducedMotion) {
      this.cameras.main.shake(55, 0.0025);
    }
  }

  private applyTexture(image: Phaser.GameObjects.Image, key: string): void {
    const override = this.overrides[key];
    if (override && this.textures.exists(override.atlas)) {
      image.setTexture(override.atlas, override.frame);
      return;
    }
    image.setTexture(key);
  }

  private isThrowing(elapsed: number): boolean {
    const windows = this.bridgeRef.current.wave.throwWindows;
    for (let index = 0; index < windows.length; index += 1) {
      if (elapsed >= windows[index].start && elapsed <= windows[index].end) return true;
    }
    return false;
  }

  private showManeuverPopup(maneuver: ManeuverEvent): void {
    const points = Math.round(maneuver.awardedPoints * 100);
    if (maneuver.type === "air") {
      this.showPopup(`AIR +${points}`, PLAY_PALETTE.cyan);
      this.time.delayedCall(280, (): void => this.showPopup("CLEAN LANDING", PLAY_PALETTE.green));
      return;
    }
    if (maneuver.type === "snap") {
      this.showPopup("CUTBACK", PLAY_PALETTE.cyan);
      return;
    }
    this.showPopup(
      maneuver.type === "barrel" ? "BARREL" : `TURN +${points}`,
      PLAY_PALETTE.yellow,
    );
  }

  private showPopup(label: string, backgroundColor: string): void {
    const bridge = this.bridgeRef.current;
    const popup = this.add.text(GAME_WIDTH / 2, 70, label, {
      fontFamily: bridge.fontFamily,
      fontSize: "10px",
      color: PLAY_PALETTE.foam,
      backgroundColor,
      stroke: PLAY_PALETTE.shadow,
      strokeThickness: 3,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: PLAY_PALETTE.shadow,
        blur: 0,
        stroke: true,
        fill: true,
      },
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5).setDepth(20).setScale(0.6).setLetterSpacing(1);
    if (bridge.reducedMotion) {
      this.time.delayedCall(700, (): void => popup.destroy());
      return;
    }
    this.tweens.add({
      targets: popup,
      scale: 1,
      y: 60,
      duration: 130,
      ease: "Cubic.Out",
      yoyo: true,
      hold: 500,
      onComplete: (): void => popup.destroy(),
    });
  }
}
