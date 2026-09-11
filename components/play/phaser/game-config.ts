import Phaser from "phaser";

import { BootScene } from "./BootScene";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";
import { PlayScene } from "./PlayScene";
import type { PhaserBridgeRef } from "./types";

export function createGameConfig(
  parent: HTMLElement,
  bridgeRef: PhaserBridgeRef,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#FFBE8A",
    render: {
      antialias: false,
      pixelArt: true,
      roundPixels: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    fps: {
      target: 60,
      min: 30,
      forceSetTimeOut: false,
    },
    input: {
      keyboard: true,
      mouse: true,
      touch: true,
    },
    audio: { noAudio: true },
    scene: [BootScene, PlayScene],
    callbacks: {
      preBoot: (game: Phaser.Game): void => {
        game.registry.set("bridge", bridgeRef);
      },
    },
  };
}
