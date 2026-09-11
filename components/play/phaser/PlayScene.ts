import Phaser from "phaser";

import {
  completeWave,
  FIXED_TIMESTEP_SECONDS,
  getArcadeScore,
  getLiveWaveScore,
  getPierWarning,
  judgeWave,
  stepSimulation,
  tickHeat,
  type HeatState,
  type ManeuverEvent,
  type Obstacle,
  type PierObstacle,
  type SimulationInput,
  type SimulationState,
} from "@/lib/play";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";
import type { PhaserBridgeRef } from "./types";

const PALETTE = {
  deepBlue: 0x0b5fa5,
  oceanBlue: 0x127cc1,
  cyan: 0x29c7f6,
  mint: 0x75e3e1,
  sky: 0xb8f1ff,
  foam: 0xf8feff,
  peach: 0xffbe8a,
  coral: 0xff8d73,
  pink: 0xf57cb3,
  lavender: 0x7d7ccf,
  yellow: 0xffd447,
  hotCoral: 0xff5c6c,
  green: 0x43d87d,
  shadow: 0x0a1d2b,
  trough: 0x0b6c82,
} as const;

const IDLE_INPUT: SimulationInput = {
  vertical: 0,
  action: false,
  actionPressed: false,
  actionReleased: false,
};

const RIDER_FRAMES = {
  idle: ["idle-0", "idle-1", "idle-2", "idle-3"],
  pump: ["pump-0", "pump-1", "pump-2", "pump-3"],
  low: ["lowline-0", "lowline-1", "lowline-2", "lowline-3"],
  bottomTurn: ["bottomturn-0", "bottomturn-1", "bottomturn-2", "bottomturn-3"],
  topTurn: ["topturn-0", "topturn-1", "topturn-2", "topturn-3"],
  cutbackInit: ["cutback-init-0", "cutback-init-1", "cutback-init-2", "cutback-init-3"],
  cutback: ["cutback-rebound-0", "cutback-rebound-1", "cutback-rebound-2"],
  barrel: ["tuck-0", "tuck-1", "tuck-2", "tuck-3"],
  takeoff: ["takeoff-0", "takeoff-1", "takeoff-2"],
  air: ["air-0", "air-1", "air-2"],
  grab: ["grab-0", "grab-1", "grab-2"],
  landing: ["landing-wobble-0", "landing-wobble-1", "landing-wobble-2"],
  wobble: ["landing-wobble-3", "landing-wobble-4", "landing-wobble-5"],
  wipeout: ["wipeout-0", "wipeout-1", "wipeout-2", "wipeout-3"],
} as const;

const DEBRIS_FRAMES = {
  plank: "debris-0",
  crate: "debris-1",
  barrel: "debris-2",
  driftwood: "debris-3",
  cooler: "debris-5",
  tire: "debris-6",
} as const;

const WAVE_BOTTOM = 474;
const FACE_OVERLAP = 20;
const FACE_FRAMES = ["wave-tile-1", "wave-tile-2", "wave-tile-3", "wave-tile-2"] as const;
const FACE_HEIGHTS = [230, 228, 228, 228] as const;
const FACE_SCALE_Y = [1.18, 1.05, 0.92, 0.8] as const;

interface RenderedObstacle {
  obstacle: Obstacle;
  bodies: Phaser.GameObjects.Image[];
  cues: Phaser.GameObjects.Image[];
}

function frameAt(frames: readonly string[], elapsed: number, fps: number): string {
  return frames[Math.floor(elapsed * fps) % frames.length];
}

function formatTimer(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export class PlayScene extends Phaser.Scene {
  private bridgeRef!: PhaserBridgeRef;
  private simulation!: SimulationState;
  private previousSimulation!: SimulationState;
  private heat!: HeatState;
  private sky!: Phaser.GameObjects.Graphics;
  private waveBackdrop!: Phaser.GameObjects.Graphics;
  private hudBars!: Phaser.GameObjects.Graphics;
  private waterTiles: Phaser.GameObjects.Image[] = [];
  private faceTiles: Phaser.GameObjects.Image[] = [];
  private shoulderTiles: Phaser.GameObjects.Image[] = [];
  private foamTiles: Phaser.GameObjects.Image[] = [];
  private lipTiles: Phaser.GameObjects.Image[] = [];
  private foamChunks: Phaser.GameObjects.Image[] = [];
  private sparkles: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private mountains: Phaser.GameObjects.Image[] = [];
  private palms: Phaser.GameObjects.Image[] = [];
  private ambientGulls: Phaser.GameObjects.Image[] = [];
  private whitewater!: Phaser.GameObjects.Image;
  private sun!: Phaser.GameObjects.Image;
  private rider!: Phaser.GameObjects.Image;
  private looseBoard!: Phaser.GameObjects.Image;
  private wipeSplash!: Phaser.GameObjects.Image;
  private wake!: Phaser.GameObjects.Image;
  private finFx!: Phaser.GameObjects.Image;
  private spray!: Phaser.GameObjects.Image;
  private obstacles: RenderedObstacle[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private dangerText!: Phaser.GameObjects.Text;
  private safeText!: Phaser.GameObjects.Text;
  private pierMini!: Phaser.GameObjects.Image;
  private pierBanner!: Phaser.GameObjects.Image;
  private popup!: Phaser.GameObjects.Image;
  private stamp!: Phaser.GameObjects.Image;
  private muteButton!: Phaser.GameObjects.Image;
  private pauseButton!: Phaser.GameObjects.Image;
  private helpPanel!: Phaser.GameObjects.Container;
  private hudStatic: Phaser.GameObjects.Components.Visible[] = [];
  private inputState: SimulationInput = { ...IDLE_INPUT };
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private pointerSide: "left" | "right" | null = null;
  private pointerY = 0;
  private accumulator = 0;
  private ambientElapsed = 0;
  private frame = 0;
  private lastManeuverCount = 0;
  private previousPhase: SimulationState["phase"] = "riding";
  private currentRiderFrame = "";
  private riderAngle = 0;
  private finished = false;
  private wasActive = false;
  private paused = false;
  private warnedPierId = "";
  private capturing = false;

  constructor() {
    super("play");
  }

  create(): void {
    this.bridgeRef = this.registry.get("bridge") as PhaserBridgeRef;
    this.simulation = this.bridgeRef.current.initialSimulation;
    this.previousSimulation = this.simulation;
    this.heat = this.bridgeRef.current.initialHeat;
    this.sky = this.add.graphics().setDepth(0);
    this.drawSkyGradient();
    this.createCoast();
    this.waveBackdrop = this.add.graphics().setDepth(2);
    this.waveBackdrop.fillStyle(PALETTE.trough).fillRect(0, WAVE_BOTTOM, GAME_WIDTH, GAME_HEIGHT - WAVE_BOTTOM);
    this.createWave();
    this.createRider();
    this.obstacles = this.createObstacleSprites();
    this.createHud();
    this.configureInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, (): void => this.removeInput());
    this.renderWorld(0);
  }

  update(_: number, delta: number): void {
    const bridge = this.bridgeRef.current;
    this.ambientElapsed += Math.min(delta, 100) / 1_000;
    if (bridge.active && !this.wasActive) this.startActiveRide();
    this.wasActive = bridge.active;

    if (!bridge.active || this.finished || this.paused) {
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

  private drawSkyGradient(): void {
    this.sky.clear();
    this.sky.fillGradientStyle(PALETTE.lavender, PALETTE.lavender, PALETTE.coral, PALETTE.peach, 1);
    this.sky.fillRect(0, 0, GAME_WIDTH, 300);
    this.sky.fillStyle(PALETTE.peach).fillRect(0, 300, GAME_WIDTH, GAME_HEIGHT - 300);
  }

  private createCoast(): void {
    this.sun = this.add.image(760, 142, "water", "sun-0").setScale(0.75).setDepth(1);
    this.clouds = [
      this.add.image(115, 105, "water", "cloud-0"),
      this.add.image(430, 128, "water", "cloud-1"),
      this.add.image(755, 82, "water", "cloud-2"),
    ];
    this.mountains = [
      this.add.image(180, 245, "water", "mountain-0"),
      this.add.image(500, 250, "water", "mountain-1"),
      this.add.image(830, 245, "water", "mountain-0"),
    ];
    this.palms = [
      this.add.image(145, 265, "water", "palms-0"),
      this.add.image(725, 270, "water", "palms-1"),
    ];
    this.ambientGulls = [
      this.add.image(175, 145, "obstacles", "gull-0"),
      this.add.image(310, 115, "obstacles", "gull-3"),
      this.add.image(650, 155, "obstacles", "gull-6"),
    ];
    for (const cloud of this.clouds) cloud.setScale(0.85).setAlpha(0.82).setDepth(1);
    for (const mountain of this.mountains) mountain.setScale(1.35, 0.9).setAlpha(0.82).setDepth(1);
    for (const palm of this.palms) palm.setScale(0.9).setAlpha(0.94).setDepth(1);
    for (const gull of this.ambientGulls) gull.setScale(0.28).setDepth(2);
  }

  private createWave(): void {
    this.waterTiles = Array.from({ length: 12 }, (_, index) =>
      this.add.image(index * 140, WAVE_BOTTOM - 2, "water", `water-tile-${index % 5}`).setOrigin(0).setScale(1.08, 0.9).setDepth(3),
    );
    this.faceTiles = FACE_FRAMES.map((frame) =>
      this.add.image(0, WAVE_BOTTOM, "water", frame).setOrigin(0, 1).setDepth(4),
    );
    this.shoulderTiles = [
      this.add.image(0, WAVE_BOTTOM, "water", "shoulder-tile-0").setOrigin(0, 1),
      this.add.image(0, WAVE_BOTTOM, "water", "shoulder-tile-1").setOrigin(0, 1),
      this.add.image(0, WAVE_BOTTOM, "water", "shoulder-tile-2").setOrigin(0, 1),
    ];
    this.foamTiles = Array.from({ length: 6 }, (_, index) =>
      this.add.image(0, 0, "water", `foam-tile-${index}`).setDepth(5),
    );
    this.lipTiles = FACE_FRAMES.map((_, index) =>
      this.add.image(0, 0, "water", `foam-line-${index % 2}`).setDepth(7),
    );
    this.foamChunks = Array.from({ length: 6 }, (_, index) =>
      this.add.image(0, 0, "obstacles", `foam-${index}`).setDepth(8),
    );
    this.sparkles = Array.from({ length: 12 }, (_, index) =>
      this.add.image(0, 0, "water", `sparkle-${index}`).setDepth(8),
    );
    this.whitewater = this.add.image(230, WAVE_BOTTOM, "water", "wave-tile-0").setOrigin(1, 1).setDepth(6);
    for (const tile of this.shoulderTiles) tile.setDepth(4);
    for (const tile of this.foamTiles) tile.setAlpha(0.96);
  }

  private createRider(): void {
    this.wake = this.add.image(390, 390, "water", "wake-0").setOrigin(1, 0.5).setDepth(10);
    this.finFx = this.add.image(405, 390, "surfer", "fx-0").setOrigin(0.8, 0.5).setDepth(10);
    this.spray = this.add.image(395, 380, "water", "spray-0").setOrigin(0.8, 0.8).setDepth(11).setVisible(false);
    this.rider = this.add.image(410, 360, "surfer", "idle-0").setOrigin(0.5, 1).setScale(0.56).setDepth(12);
    this.looseBoard = this.add.image(0, 0, "surfer", "board-loose-0").setScale(0.52).setDepth(13).setVisible(false);
    this.wipeSplash = this.add.image(0, 0, "surfer", "splash-board-0").setScale(0.58).setDepth(11).setVisible(false);
  }

  private createHud(): void {
    const bridge = this.bridgeRef.current;
    const panel = (x: number, y: number, width: number, height: number): Phaser.GameObjects.NineSlice => {
      const image = this.add.nineslice(x, y, "ui", "plate-dark", width, height, 10, 10, 10, 10).setOrigin(0).setDepth(30);
      this.hudStatic.push(image);
      return image;
    };
    const label = (x: number, y: number, value: string, size = 11): Phaser.GameObjects.Text => {
      const text = this.add.text(x, y, value, {
        fontFamily: bridge.fontFamily,
        fontSize: `${size}px`,
        color: "#F8FEFF",
        stroke: "#0A1D2B",
        strokeThickness: 3,
      }).setDepth(33);
      this.hudStatic.push(text);
      return text;
    };

    panel(12, 10, 184, 73);
    panel(12, 87, 184, 33);
    panel(210, 10, 545, 49);
    panel(210, 64, 545, 56);
    panel(772, 10, 176, 73);
    label(28, 20, "SCORE", 12);
    label(28, 94, "BEST", 10);
    label(788, 20, "TIME", 12);
    this.scoreText = label(28, 43, "000000", 21);
    this.bestText = label(184, 94, "000000", 10).setOrigin(1, 0);
    this.timeText = label(788, 43, "01:30", 18);
    this.waveText = label(226, 22, "WAVE 1 / 3", 11);
    this.dangerText = label(226, 75, "DANGER / FOAM GAP", 9);
    this.safeText = label(704, 94, "SAFE", 9).setOrigin(1, 0);
    this.hudBars = this.add.graphics().setDepth(32);
    this.hudStatic.push(this.hudBars);
    this.pierMini = this.add.image(860, 105, "ui", "panel-pier-mini-0").setScale(0.56).setDepth(34).setVisible(false);
    this.pierBanner = this.add.image(GAME_WIDTH + 310, 220, "ui", "banner-pier-0").setScale(0.72).setDepth(36).setVisible(false);
    this.popup = this.add.image(GAME_WIDTH / 2, 150, "ui", "popup-8").setScale(0.65).setDepth(37).setVisible(false);
    this.stamp = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "ui", "stamp-1").setScale(0.88).setDepth(38).setVisible(false);

    this.muteButton = this.add.image(800, 133, "ui", bridge.muted ? "btn-mute-0" : "btn-sound-0")
      .setOrigin(0, 0).setScale(0.42).setDepth(35).setInteractive({ useHandCursor: true });
    const helpButton = this.add.image(844, 133, "ui", "btn-help-0")
      .setOrigin(0, 0).setScale(0.42).setDepth(35).setInteractive({ useHandCursor: true });
    this.pauseButton = this.add.image(888, 133, "ui", "btn-pause-0")
      .setOrigin(0, 0).setScale(0.42).setDepth(35).setInteractive({ useHandCursor: true });
    this.hudStatic.push(this.muteButton, helpButton, this.pauseButton);
    this.muteButton.on("pointerdown", (): void => {
      bridge.onToggleMute();
      this.muteButton.setFrame(this.bridgeRef.current.muted ? "btn-mute-0" : "btn-sound-0");
    });
    this.pauseButton.on("pointerdown", (): void => {
      this.paused = !this.paused;
      this.pauseButton.setFrame(this.paused ? "btn-play-0" : "btn-pause-0");
    });
    this.helpPanel = this.createHelpPanel();
    helpButton.on("pointerdown", (): void => {
      this.helpPanel.setVisible(!this.helpPanel.visible);
    });
    this.hudStatic.push(...this.createTouchControls());
  }

  private createHelpPanel(): Phaser.GameObjects.Container {
    const bridge = this.bridgeRef.current;
    const plate = this.add.nineslice(0, 0, "ui", "plate-blue", 420, 175, 10, 10, 10, 10).setOrigin(0);
    const title = this.add.text(22, 18, "RIDE THE LINE", {
      fontFamily: bridge.fontFamily,
      fontSize: "13px",
      color: "#F8FEFF",
      stroke: "#0A1D2B",
      strokeThickness: 3,
    });
    const copy = this.add.text(22, 57, "UP / DOWN   FIND SPEED\nSPACE       PUMP / AIR\nX           STICK TRICK", {
      fontFamily: bridge.fontFamily,
      fontSize: "9px",
      color: "#B8F1FF",
      lineSpacing: 11,
    });
    const keys = [
      this.add.image(287, 62, "ui", "key-0"),
      this.add.image(335, 62, "ui", "key-1"),
      this.add.image(307, 122, "ui", "key-space-0"),
    ];
    for (const key of keys) key.setScale(0.34);
    return this.add.container(270, 180, [plate, title, copy, ...keys]).setDepth(45).setVisible(false);
  }

  private createTouchControls(): Phaser.GameObjects.Image[] {
    if (!window.matchMedia("(pointer: coarse)").matches) return [];
    const up = this.add.image(65, 455, "ui", "circle-btn-0").setScale(0.55).setDepth(40).setInteractive();
    const down = this.add.image(135, 468, "ui", "circle-btn-1").setScale(0.55).setDepth(40).setInteractive();
    const jump = this.add.image(815, 465, "ui", "circle-btn-3").setScale(0.55).setDepth(40).setInteractive();
    const trick = this.add.image(895, 458, "ui", "circle-btn-4").setScale(0.5).setDepth(40).setInteractive();
    up.on("pointerdown", (): void => { this.inputState.vertical = 1; });
    down.on("pointerdown", (): void => { this.inputState.vertical = -1; });
    up.on("pointerup", (): void => { this.inputState.vertical = 0; });
    down.on("pointerup", (): void => { this.inputState.vertical = 0; });
    jump.on("pointerdown", (): void => this.onActionDown());
    trick.on("pointerdown", (): void => this.onActionDown());
    jump.on("pointerup", (): void => this.onActionUp());
    trick.on("pointerup", (): void => this.onActionUp());
    return [up, down, jump, trick];
  }

  private configureInput(): void {
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      keyboard.on("keydown-SPACE", this.onActionDown, this);
      keyboard.on("keyup-SPACE", this.onActionUp, this);
      keyboard.on("keydown-X", this.onActionDown, this);
      keyboard.on("keyup-X", this.onActionUp, this);
    }
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
  }

  private removeInput(): void {
    this.input.keyboard?.off("keydown-SPACE", this.onActionDown, this);
    this.input.keyboard?.off("keyup-SPACE", this.onActionUp, this);
    this.input.keyboard?.off("keydown-X", this.onActionDown, this);
    this.input.keyboard?.off("keyup-X", this.onActionUp, this);
    this.input.off("pointerdown", this.onPointerDown, this);
    this.input.off("pointermove", this.onPointerMove, this);
    this.input.off("pointerup", this.onPointerUp, this);
    this.input.off("pointerupoutside", this.onPointerUp, this);
  }

  private onActionDown(): void {
    if (!this.bridgeRef.current.active || this.inputState.action || this.paused) return;
    this.inputState.action = true;
    this.inputState.actionPressed = true;
  }

  private onActionUp(): void {
    if (!this.bridgeRef.current.active || !this.inputState.action) return;
    this.inputState.action = false;
    this.inputState.actionReleased = true;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.bridgeRef.current.active || pointer.y < 160 || this.paused) return;
    this.pointerSide = pointer.x < GAME_WIDTH / 2 ? "left" : "right";
    this.pointerY = pointer.y;
    if (this.pointerSide === "right") this.onActionDown();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown || this.pointerSide !== "left") return;
    const delta = this.pointerY - pointer.y;
    this.inputState.vertical = delta > 4 ? 1 : delta < -4 ? -1 : 0;
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
    this.inputState = { ...IDLE_INPUT };
    this.accumulator = 0;
    this.frame = 0;
    this.lastManeuverCount = 0;
    this.previousPhase = this.simulation.phase;
    this.finished = false;
    this.paused = false;
    this.warnedPierId = "";
    this.showStartSequence();
  }

  private showStartSequence(): void {
    const frames = ["stamp-1", "stamp-2", "stamp-0"];
    frames.forEach((frame, index) => {
      this.time.delayedCall(index * 380, (): void => {
        this.stamp.setFrame(frame).setScale(0.72).setAlpha(1).setVisible(true);
        this.tweens.killTweensOf(this.stamp);
        this.tweens.add({ targets: this.stamp, scale: 0.92, duration: 160, yoyo: true });
      });
    });
    this.time.delayedCall(1_100, (): void => {
      this.stamp.setVisible(false);
    });
  }

  private stepEngine(): void {
    const bridge = this.bridgeRef.current;
    if (this.pointerSide !== "left") {
      this.inputState.vertical = this.cursors?.up.isDown ? 1 : this.cursors?.down.isDown ? -1 : 0;
    }
    this.previousSimulation = this.simulation;
    this.simulation = stepSimulation(this.simulation, this.inputState, bridge.definition, bridge.wave);
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
      this.showPopup("popup-4");
    }
    if (this.previousPhase === "wipeout" && this.simulation.phase === "complete") bridge.audio.gasp();
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
    this.stamp.setVisible(false);
    const delay = bridge.reducedMotion ? 0 : 650;
    this.time.delayedCall(delay, (): void => {
      this.capturing = true;
      this.setHudVisible(false);
      this.time.delayedCall(34, (): void => {
        bridge.onFrameCapture(this.game.canvas.toDataURL("image/png"));
        this.capturing = false;
        bridge.onSnapshot({ simulation: this.simulation, heat: this.heat, liveScore: score });
        bridge.onWaveComplete(this.heat, this.simulation, score);
      });
    });
  }

  private renderWorld(interpolation: number): void {
    const bridge = this.bridgeRef.current;
    const active = bridge.active;
    const state = this.simulation;
    const elapsed = active ? state.elapsed : this.ambientElapsed;
    const motionElapsed = bridge.reducedMotion ? 0 : elapsed;
    const facePosition = active
      ? Phaser.Math.Linear(this.previousSimulation.facePosition, state.facePosition, interpolation)
      : 0.48 + Math.sin(elapsed * 1.4) * 0.08;
    const sectionDistance = active
      ? Phaser.Math.Linear(this.previousSimulation.sectionDistance, state.sectionDistance, interpolation)
      : 0.72;
    const riderX = 410;
    const airProgress = state.phase === "airborne" ? Phaser.Math.Clamp(state.phaseElapsed / 0.31, 0, 1) : 0;
    const airLift = state.phase === "airborne" ? Math.sin(airProgress * Math.PI) * 92 : 0;
    const sectionX = riderX - sectionDistance * 230;
    const throwing = this.isThrowing(state.elapsed) || (!active && bridge.definition.index >= 4);
    const foamPressure = Phaser.Math.Clamp((40 - state.speed) / 40, 0, 1);

    this.positionCoast(motionElapsed);
    this.positionWave(sectionX, motionElapsed, throwing, foamPressure);
    const riderY = this.getRiderY(riderX, facePosition) - airLift;
    this.positionObstacles(elapsed, active);
    this.positionRider(facePosition, riderX, riderY, elapsed);
    this.positionEffects(riderX, riderY, sectionX, motionElapsed, throwing);
    this.updateHud(active);
  }

  private positionCoast(elapsed: number): void {
    this.sun.x = 760 - elapsed * 0.3 % 30;
    for (let index = 0; index < this.clouds.length; index += 1) {
      this.clouds[index].x = Phaser.Math.Wrap(115 + index * 320 - elapsed * (2 + index), -120, 1_080);
    }
    for (let index = 0; index < this.mountains.length; index += 1) {
      this.mountains[index].x = Phaser.Math.Wrap(180 + index * 330 - elapsed * 1.1, -150, 1_110);
    }
    for (let index = 0; index < this.palms.length; index += 1) {
      this.palms[index].x = Phaser.Math.Wrap(145 + index * 580 - elapsed * 2.1, -200, 1_160);
    }
    for (let index = 0; index < this.ambientGulls.length; index += 1) {
      const gull = this.ambientGulls[index];
      gull.x = Phaser.Math.Wrap(175 + index * 245 - elapsed * (10 + index * 2), -80, 1_040);
      gull.setFrame(`gull-${Math.floor(elapsed * 9 + index * 3) % 9}`);
    }
  }

  private positionWave(sectionX: number, elapsed: number, throwing: boolean, pressure: number): void {
    const scale = 0.82 + this.bridgeRef.current.wave.height * 0.18;
    const waterLoopWidth = this.waterTiles.slice(0, 5).reduce((width, tile) => width + tile.displayWidth - 2, 0);
    let waterX = -(elapsed * 7 % waterLoopWidth);
    for (let index = 0; index < this.waterTiles.length; index += 1) {
      const tile = this.waterTiles[index];
      tile.x = waterX;
      waterX += tile.displayWidth - 2;
    }

    let faceX = sectionX - FACE_OVERLAP - Math.min(elapsed, 50) * 2;
    for (let index = 0; index < this.faceTiles.length; index += 1) {
      const tile = this.faceTiles[index];
      const curling = throwing && index === 0;
      const frame = curling ? "wave-tile-4" : FACE_FRAMES[index];
      const targetHeight = FACE_HEIGHTS[index] * scale * FACE_SCALE_Y[index] * (curling ? 1.15 : 1);
      tile.setFrame(frame)
        .setPosition(faceX, WAVE_BOTTOM)
        .setScale(scale * (curling ? 1 : 1.08), targetHeight / (curling ? 270 : FACE_HEIGHTS[index]))
        .setFlipX(index % 2 === 1);
      faceX += tile.displayWidth - FACE_OVERLAP;
    }
    this.whitewater.setPosition(sectionX, WAVE_BOTTOM).setScale(scale * (1 + pressure * 0.12), scale * 1.08);

    const shoulderScaleX = [0.72, 0.9, 0.82] as const;
    const shoulderScaleY = [0.58, 0.46, 0.38] as const;
    let shoulderX = faceX - FACE_OVERLAP;
    for (let index = 0; index < this.shoulderTiles.length; index += 1) {
      const tile = this.shoulderTiles[index];
      tile.setPosition(shoulderX, WAVE_BOTTOM)
        .setScale(shoulderScaleX[index] * scale, shoulderScaleY[index] * scale)
        .setFlipX(index === 1);
      shoulderX += tile.displayWidth - 12;
    }

    for (let index = 0; index < this.foamTiles.length; index += 1) {
      const tile = this.foamTiles[index];
      const spacing = Math.max(42, sectionX / 5);
      tile.setOrigin(0.5, 1)
        .setPosition(sectionX - 54 - index * spacing, WAVE_BOTTOM - 18 - index % 3 * 44)
        .setScale(0.7 + index % 2 * 0.08, 0.72)
        .setFlipX(index % 2 === 1);
    }
    for (let index = 0; index < this.lipTiles.length; index += 1) {
      const tile = this.lipTiles[index];
      const face = this.faceTiles[index];
      tile.setPosition(
        face.x + face.displayWidth / 2,
        face.y - face.displayHeight + 30 + Math.sin(elapsed * 4 + index) * 2,
      ).setScale(Math.max(0.72, face.displayWidth / 145), 0.48).setFlipX(index % 2 === 1);
    }
    for (let index = 0; index < this.foamChunks.length; index += 1) {
      const chunk = this.foamChunks[index];
      const orbit = elapsed * (18 + pressure * 16) + index * 31;
      chunk.setPosition(sectionX - 8 + orbit % 105, 218 + index * 37 + orbit % 24)
        .setAngle(orbit * (index % 2 ? -1 : 1))
        .setScale(0.3 + pressure * 0.12)
        .setAlpha(0.8 + pressure * 0.18);
    }
    for (let index = 0; index < this.sparkles.length; index += 1) {
      const sparkle = this.sparkles[index];
      sparkle.setPosition(Phaser.Math.Wrap(275 + index * 73 - elapsed * (16 + index), 245, 940), 310 + index % 4 * 38);
      sparkle.setScale(0.38).setVisible(!this.bridgeRef.current.reducedMotion || index < 4);
    }
  }

  private getRiderY(riderX: number, facePosition: number): number {
    const face = this.faceTiles.find((tile) => riderX >= tile.x && riderX <= tile.x + tile.displayWidth)
      ?? this.faceTiles[0];
    return face.y - 10 - facePosition * Math.max(70, face.displayHeight - 24);
  }

  private createObstacleSprites(): RenderedObstacle[] {
    return this.bridgeRef.current.wave.obstacles.map((obstacle) => {
      if (obstacle.kind === "pier") {
        const bodies = obstacle.pattern === "double-post-gap"
          ? [
              this.add.image(0, 0, "obstacles", "post-pair-0"),
              this.add.image(0, 0, "obstacles", "post-base-0"),
              this.add.image(0, 0, "obstacles", "post-shadow-1"),
            ]
          : obstacle.posts.flatMap((_, index) => [
              this.add.image(0, 0, "obstacles", `post-${index % 4}`),
              this.add.image(0, 0, "obstacles", `post-base-${index % 4}`),
              this.add.image(0, 0, "obstacles", `post-shadow-${1 + index % 3}`),
            ]);
        if (obstacle.pattern === "cross-brace") bodies.push(this.add.image(0, 0, "obstacles", "post-brace-0"));
        return {
          obstacle,
          bodies: bodies.map((image) => image.setDepth(13).setVisible(false)),
          cues: [this.add.image(0, 0, "obstacles", "marker-alert-0").setDepth(14).setVisible(false)],
        };
      }

      const frame = obstacle.kind === "debris"
        ? DEBRIS_FRAMES[obstacle.variant]
        : obstacle.kind === "seagull" ? "gull-0"
        : obstacle.kind === "bodyboarder" ? "bodyboard-0"
        : `${obstacle.kind}-0`;
      const bodies = obstacle.kind === "fish"
        ? [
            this.add.image(0, 0, "obstacles", "marker-0"),
            this.add.image(0, 0, "obstacles", "fish-arc-0"),
            this.add.image(0, 0, "obstacles", "fish-splash-0"),
          ]
        : [this.add.image(0, 0, "obstacles", frame)];
      return {
        obstacle,
        bodies: bodies.map((image) => image.setDepth(13).setVisible(false)),
        cues: [this.add.image(0, 0, "obstacles", "marker-alert-0").setDepth(14).setVisible(false)],
      };
    });
  }

  private positionObstacles(elapsed: number, active: boolean): void {
    for (const rendered of this.obstacles) {
      for (const image of rendered.bodies) image.setVisible(false);
      for (const image of rendered.cues) image.setVisible(false);
      const obstacle = rendered.obstacle;
      if (!active || elapsed < obstacle.cueAt || elapsed > obstacle.endAt + 0.8) continue;
      const x = 410 + (obstacle.hitAt - elapsed) * 128;
      const imminent = elapsed >= obstacle.hitAt - 0.7;
      if (imminent) rendered.cues[0].setPosition(x, 250).setScale(0.4).setVisible(true);

      if (obstacle.kind === "pier") {
        this.positionPier(rendered, obstacle, x, elapsed);
        continue;
      }
      if (obstacle.kind === "seagull") {
        rendered.bodies[0].setFrame(`gull-${Math.floor(elapsed * 10) % 9}`).setPosition(x, 255).setScale(0.5).setVisible(true);
        continue;
      }
      if (obstacle.kind === "fish") {
        if (elapsed < obstacle.hitAt) {
          rendered.bodies[0].setFrame(`marker-${Math.floor(elapsed * 9) % 3}`).setPosition(x, 440).setScale(0.45).setVisible(true);
          continue;
        }
        if (elapsed <= obstacle.endAt) {
          const progress = (elapsed - obstacle.hitAt) / (obstacle.endAt - obstacle.hitAt);
          rendered.bodies[1].setFrame(`fish-arc-${Math.min(2, Math.floor(progress * 3))}`)
            .setPosition(x, 430 - Math.sin(progress * Math.PI) * 105).setScale(0.52).setVisible(true);
          continue;
        }
        rendered.bodies[2].setFrame(`fish-splash-${Math.floor(elapsed * 9) % 3}`).setPosition(x, 440).setScale(0.55).setVisible(true);
        continue;
      }
      if (obstacle.kind === "debris") {
        rendered.bodies[0].setPosition(x, 438 + Math.sin(elapsed * 5) * 4).setScale(0.5).setVisible(true);
        continue;
      }
      if (obstacle.kind === "swimmer" || obstacle.kind === "bodyboarder") {
        const prefix = obstacle.kind === "bodyboarder" ? "bodyboard" : "swimmer";
        rendered.bodies[0].setFrame(`${prefix}-${Math.floor(elapsed * 8) % 3}`).setPosition(x, 405).setScale(0.48).setVisible(true);
        continue;
      }
      rendered.bodies[0].setFrame(`buoy-${Math.floor(elapsed * 7) % 4}`).setPosition(x, 417 + Math.sin(elapsed * 3) * 5).setScale(0.5).setVisible(true);
    }

    const warning = active ? getPierWarning(this.bridgeRef.current.wave.obstacles, elapsed) : null;
    this.pierMini.setVisible(Boolean(warning) && !this.capturing);
    if (warning && warning.id !== this.warnedPierId) {
      this.warnedPierId = warning.id;
      this.showPierBanner();
    }
  }

  private positionPier(rendered: RenderedObstacle, obstacle: PierObstacle, x: number, elapsed: number): void {
    if (obstacle.pattern === "double-post-gap") {
      rendered.bodies[0].setFrame(`post-pair-${Math.floor(elapsed * 4) % 2}`).setPosition(x, 390).setScale(0.76).setVisible(true);
      rendered.bodies[1].setFrame(`post-base-${Math.floor(elapsed * 8) % 4}`).setPosition(x, 454).setScale(0.62).setVisible(true);
      rendered.bodies[2].setPosition(x, 482).setScale(0.68).setAlpha(0.55).setVisible(true);
      return;
    }
    const laneY = { upper: 330, mid: 395, low: 458 } as const;
    obstacle.posts.forEach((post, index) => {
      const offset = index * 3;
      const y = laneY[post.lane];
      rendered.bodies[offset].setPosition(x, y).setOrigin(0.5, 1).setScale(0.72).setVisible(true);
      rendered.bodies[offset + 1].setFrame(`post-base-${Math.floor(elapsed * 8 + index) % 4}`).setPosition(x, y).setScale(0.58).setVisible(true);
      rendered.bodies[offset + 2].setPosition(x, y + 42).setScale(0.62).setAlpha(0.55).setVisible(true);
    });
    if (obstacle.pattern === "cross-brace") rendered.bodies.at(-1)?.setPosition(x, 382).setScale(0.7).setVisible(true);
  }

  private positionRider(facePosition: number, riderX: number, riderY: number, elapsed: number): void {
    const frame = this.getRiderFrame(elapsed, facePosition);
    if (frame !== this.currentRiderFrame) {
      this.rider.setFrame(frame);
      this.currentRiderFrame = frame;
    }
    const wipeout = this.simulation.stats.wipeout;
    this.riderAngle = this.getRiderAngle(facePosition, elapsed);
    this.rider.setPosition(riderX, riderY)
      .setAngle(wipeout ? this.simulation.phaseElapsed * 240 : this.riderAngle)
      .setFlipX(frame.startsWith("cutback-rebound"))
      .setDepth(this.simulation.inBarrel ? 8 : 12)
      .setVisible(true);
    this.looseBoard.setVisible(wipeout)
      .setPosition(riderX + 75 + this.simulation.phaseElapsed * 25, riderY + 25)
      .setAngle(-18 - this.simulation.phaseElapsed * 100);
    this.wipeSplash.setVisible(wipeout)
      .setFrame(this.simulation.phaseElapsed > 1.1 ? "splash-board2-0" : "splash-board-0")
      .setPosition(riderX + 15, riderY + 25);
  }

  private getRiderFrame(elapsed: number, facePosition: number): string {
    const state = this.simulation;
    if (state.stats.wipeout) return frameAt(RIDER_FRAMES.wipeout, state.phaseElapsed, 9);
    if (state.phase === "airborne") {
      if (state.phaseElapsed < 0.09) return frameAt(RIDER_FRAMES.takeoff, state.phaseElapsed, 11);
      return this.inputState.action ? frameAt(RIDER_FRAMES.grab, state.phaseElapsed, 10) : frameAt(RIDER_FRAMES.air, state.phaseElapsed, 10);
    }
    if (state.inBarrel) return frameAt(RIDER_FRAMES.barrel, elapsed, 9);
    const maneuver = state.stats.maneuvers.at(-1);
    const age = maneuver ? state.elapsed - maneuver.at : 99;
    if (maneuver?.type === "air" && age < 0.45) return frameAt(RIDER_FRAMES.landing, age, 10);
    if (maneuver?.type === "snap" && age < 0.55) {
      if (state.stats.maneuvers.at(-2)?.type === "snap") {
        return age < 0.28 ? frameAt(RIDER_FRAMES.cutbackInit, age, 10) : frameAt(RIDER_FRAMES.cutback, age - 0.28, 10);
      }
      return frameAt(RIDER_FRAMES.topTurn, age, 10);
    }
    if (maneuver?.type === "bottom-turn" && age < 0.55) return frameAt(RIDER_FRAMES.bottomTurn, age, 10);
    if (state.speed < 12) return frameAt(RIDER_FRAMES.wobble, elapsed, 8);
    if (state.pumping) return frameAt(RIDER_FRAMES.pump, elapsed, 10);
    if (facePosition < 0.3) return frameAt(RIDER_FRAMES.low, elapsed, 8);
    return frameAt(RIDER_FRAMES.idle, elapsed, 8);
  }

  private getRiderAngle(facePosition: number, elapsed: number): number {
    const state = this.simulation;
    if (state.phase === "airborne") return -20 + Phaser.Math.Clamp(state.phaseElapsed / 0.31, 0, 1) * 36;
    if (state.inBarrel) return -5;
    const maneuver = state.stats.maneuvers.at(-1);
    const age = maneuver ? elapsed - maneuver.at : 99;
    if (maneuver?.type === "bottom-turn" && age < 0.55) return -22 + age * 22;
    if (maneuver?.type === "snap" && age < 0.55) return 20 - age * 28;
    return (facePosition - 0.48) * 23;
  }

  private positionEffects(riderX: number, riderY: number, sectionX: number, elapsed: number, throwing: boolean): void {
    const wipeout = this.simulation.phase === "wipeout";
    const speedScale = Phaser.Math.Clamp((this.simulation.speed - 20) / 55, 0, 1);
    const tailX = riderX - 35;
    const tailY = riderY + 5;
    this.wake.setFrame(`wake-${Math.floor(elapsed * 10) % 6}`).setPosition(tailX, tailY)
      .setAngle(this.riderAngle).setScale(0.35 + speedScale * 0.2).setVisible(!wipeout);
    this.finFx.setFrame(`fx-${Math.floor(elapsed * 10) % 3}`).setPosition(tailX + 12, tailY)
      .setAngle(this.riderAngle).setScale(0.34).setVisible(!wipeout);
    const recent = this.simulation.stats.maneuvers.at(-1);
    const maneuverSpray = recent ? this.simulation.elapsed - recent.at < 0.4 : false;
    const launch = this.simulation.phase === "airborne" && this.simulation.phaseElapsed < 0.16;
    const sprayFrame = launch ? `spray-arc-${Math.floor(elapsed * 10) % 3}` : `spray-${Math.floor(elapsed * 10) % 2}`;
    this.spray.setFrame(sprayFrame).setPosition(tailX, tailY).setAngle(this.riderAngle)
      .setScale(launch ? 0.55 : 0.4).setVisible(!wipeout && (launch || maneuverSpray || throwing));
    if (sectionX > riderX - 45 && !this.bridgeRef.current.reducedMotion) this.cameras.main.shake(55, 0.002);
  }

  private updateHud(active: boolean): void {
    const visible = active && !this.capturing;
    this.setHudVisible(visible);
    if (!visible) return;

    const bridge = this.bridgeRef.current;
    const arcadeScore = this.heat.arcadeScore + (active && !this.finished ? getArcadeScore(this.simulation.stats) : 0);
    const best = bridge.currentBestArcadeScore ?? 0;
    const waveProgress = Phaser.Math.Clamp(this.simulation.elapsed / bridge.wave.duration, 0, 1);
    const gap = Phaser.Math.Clamp(this.simulation.sectionDistance / 0.82, 0, 1);
    const gapColour = gap < 0.25 ? PALETTE.hotCoral : gap < 0.48 ? PALETTE.yellow : PALETTE.mint;
    this.scoreText.setText(String(Math.min(999_999, arcadeScore)).padStart(6, "0"));
    this.bestText.setText(String(Math.min(999_999, best)).padStart(6, "0"));
    this.timeText.setText(this.heat.practice ? "--:--" : formatTimer(this.heat.secondsRemaining));
    this.waveText.setText(`WAVE ${Math.min(bridge.definition.maxWaves, this.heat.currentWaveIndex + 1)} / ${bridge.definition.maxWaves}`);
    this.safeText.setText(gap < 0.25 ? "DANGER" : gap < 0.48 ? "WATCH" : "SAFE").setColor(gap < 0.25 ? "#FF5C6C" : gap < 0.48 ? "#FFD447" : "#75E3E1");
    this.muteButton.setFrame(bridge.muted ? "btn-mute-0" : "btn-sound-0");
    this.hudBars.clear();
    this.hudBars.fillStyle(PALETTE.shadow).fillRect(385, 28, 345, 16).fillRect(385, 91, 300, 14);
    this.hudBars.fillStyle(PALETTE.coral).fillRect(388, 31, 339 * waveProgress, 10);
    this.hudBars.fillStyle(gapColour).fillRect(388, 94, 294 * gap, 8);
  }

  private setHudVisible(visible: boolean): void {
    for (const object of this.hudStatic) object.setVisible(visible);
    if (visible) return;
    this.pierMini.setVisible(false);
    this.pierBanner.setVisible(false);
    this.popup.setVisible(false);
    this.stamp.setVisible(false);
    this.helpPanel.setVisible(false);
  }

  private showManeuverPopup(maneuver: ManeuverEvent): void {
    const frame = maneuver.type === "air" ? "popup-0"
      : maneuver.type === "barrel" ? "popup-1"
      : maneuver.type === "snap" ? "popup-2"
      : "popup-8";
    this.showPopup(frame);
    if (maneuver.type === "air") this.time.delayedCall(350, (): void => this.showPopup("popup-3"));
    const combo = Math.min(4, Math.floor(maneuver.flowMultiplier));
    if (combo >= 2) this.time.delayedCall(700, (): void => this.showPopup(`popup-${combo + 3}`));
    if (maneuver.type === "air") {
      const tier = judgeWave(this.simulation.stats).score >= 8 ? "popup-9" : "popup-8";
      this.time.delayedCall(1_050, (): void => this.showPopup(tier));
    }
  }

  private showPopup(frame: string): void {
    this.tweens.killTweensOf(this.popup);
    this.popup.setFrame(frame).setPosition(GAME_WIDTH / 2, 155).setScale(0.55).setAlpha(1).setVisible(true);
    if (this.bridgeRef.current.reducedMotion) {
      this.time.delayedCall(700, (): void => {
        this.popup.setVisible(false);
      });
      return;
    }
    this.tweens.add({
      targets: this.popup,
      y: 175,
      scale: 0.72,
      duration: 150,
      yoyo: true,
      hold: 520,
      onComplete: (): void => {
        this.popup.setVisible(false);
      },
    });
  }

  private showPierBanner(): void {
    this.tweens.killTweensOf(this.pierBanner);
    this.pierBanner.setPosition(GAME_WIDTH + 260, 220).setVisible(true);
    if (this.bridgeRef.current.reducedMotion) {
      this.pierBanner.setX(GAME_WIDTH / 2);
      this.time.delayedCall(1_100, (): void => {
        this.pierBanner.setVisible(false);
      });
      return;
    }
    this.tweens.add({
      targets: this.pierBanner,
      x: GAME_WIDTH / 2,
      duration: 260,
      ease: "Back.Out",
      yoyo: true,
      hold: 900,
      onComplete: (): void => {
        this.pierBanner.setVisible(false);
      },
    });
  }

  private isThrowing(elapsed: number): boolean {
    return this.bridgeRef.current.wave.throwWindows.some(({ start, end }) => elapsed >= start && elapsed <= end);
  }
}
