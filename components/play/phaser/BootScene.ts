import Phaser from "phaser";

import { PIXEL_COLOURS, PIXEL_TEXTURES, type PixelTextureDefinition } from "./pixel-sprites";
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
    for (const definition of PIXEL_TEXTURES) this.createPixelTexture(definition);

    const manifest = (this.cache.json.get("sprite-manifest") as SpriteManifest | undefined)
      ?? EMPTY_MANIFEST;
    this.registry.set("sprite-overrides", manifest.overrides ?? {});
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

  private createPixelTexture(definition: PixelTextureDefinition): void {
    const width = Math.max(...definition.rows.map((row) => row.length));
    const height = definition.rows.length;
    const texture = this.textures.createCanvas(definition.key, width, height);
    if (!texture) return;

    const context = texture.context;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, width, height);
    for (let y = 0; y < height; y += 1) {
      const row = definition.rows[y];
      for (let x = 0; x < row.length; x += 1) {
        const colour = PIXEL_COLOURS[row[x]];
        if (!colour) continue;
        context.fillStyle = colour;
        context.fillRect(x, y, 1, 1);
      }
    }
    texture.refresh();
  }

  private startPlayScene(): void {
    const bridgeRef = this.registry.get("bridge") as PhaserBridgeRef;
    void document.fonts.load(`8px ${bridgeRef.current.fontFamily}`).finally(() => {
      this.scene.start("play");
    });
  }
}
