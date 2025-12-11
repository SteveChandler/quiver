declare module 'canvas-confetti' {
  interface ConfettiOptions {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    shapes?: ('square' | 'circle' | 'star')[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  interface Confetti {
    (options?: ConfettiOptions): Promise<null>;
    reset: () => void;
    create: (canvas: HTMLCanvasElement | null, options?: { resize?: boolean; useWorker?: boolean }) => Confetti;
  }

  const confetti: Confetti;
  export default confetti;
}
