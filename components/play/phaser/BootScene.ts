import Phaser from "phaser";

import type { PhaserBridgeRef, SpriteManifest } from "./types";

const EMPTY_MANIFEST: SpriteManifest = { atlases: [] };

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.json("sprite-manifest", "/play/sprites/manifest.json");
  }

  create(): void {
    const manifest = (this.cache.json.get("sprite-manifest") as SpriteManifest | undefined)
      ?? EMPTY_MANIFEST;
    if (manifest.atlases.length === 0) {
      this.startPlayScene();
      return;
    }

    for (const atlas of manifest.atlases) {
      this.load.atlas(atlas.key, atlas.image, atlas.json);
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, (): void => this.startPlayScene());
    this.load.start();
  }

  private startPlayScene(): void {
    const bridgeRef = this.registry.get("bridge") as PhaserBridgeRef;
    void document.fonts.load(`8px ${bridgeRef.current.fontFamily}`).finally(() => {
      this.scene.start("play");
    });
  }
}
