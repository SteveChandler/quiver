"use client";

import Phaser from "phaser";
import { useEffect, useRef, type ReactElement } from "react";

import { createGameConfig } from "./game-config";
import type { PhaserBridge, PhaserBridgeRef } from "./types";

export type PhaserHostProps = Omit<PhaserBridge, "fontFamily">;

export default function PhaserHost(props: PhaserHostProps): ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<PhaserBridge>({ ...props, fontFamily: "monospace" });
  bridgeRef.current = { ...props, fontFamily: bridgeRef.current.fontFamily };

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const fontFamily = getComputedStyle(parent)
      .getPropertyValue("--font-play-pixel")
      .trim() || "monospace";
    bridgeRef.current.fontFamily = fontFamily;
    const game = new Phaser.Game(createGameConfig(parent, bridgeRef as PhaserBridgeRef));
    const resizeObserver = new ResizeObserver((): void => {
      game.scale.refresh();
    });
    resizeObserver.observe(parent);
    const canvas = game.canvas;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      `Side-on surf at ${bridgeRef.current.definition.name}. Use up and down arrows to move, and hold then release Space to maneuver.`,
    );

    const handleVisibility = (): void => {
      if (document.hidden) {
        game.loop.sleep();
        return;
      }
      game.loop.wake();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return (): void => {
      document.removeEventListener("visibilitychange", handleVisibility);
      resizeObserver.disconnect();
      game.destroy(true);
    };
  }, []);

  return (
    <div
      ref={parentRef}
      className={`${props.active ? "aspect-video" : "min-h-[calc(100svh-112px)] sm:aspect-video sm:min-h-0"} w-full touch-none overflow-hidden bg-[#FFBE8A] [font-family:var(--font-play-pixel)]`}
      data-testid="phaser-game"
    />
  );
}
