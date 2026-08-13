"use client";

import { Download } from "lucide-react";
import { useRef, useState } from "react";

interface DownloadFigureButtonProps {
  title: string;
  summary: string;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(/\s+/);
  let line = "";
  let nextY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, nextY);
      line = word;
      nextY += lineHeight;
      continue;
    }
    line = testLine;
  }

  if (line) {
    ctx.fillText(line, x, nextY);
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadSvgImage(svg: SVGSVGElement): Promise<HTMLImageElement | null> {
  if (typeof XMLSerializer === "undefined") return null;

  const serialized = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([serialized], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

export function DownloadFigureButton({
  title,
  summary,
}: DownloadFigureButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleDownload = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);

    try {
      const figure = buttonRef.current?.closest("figure");
      const sourceCanvas = figure?.querySelector("canvas");
      const sourceSvg = Array.from(figure?.querySelectorAll("svg") ?? []).find(
        (svg) => !buttonRef.current?.contains(svg)
      );
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#F4EBD8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#11100D";
      ctx.fillRect(42, 42, canvas.width - 84, canvas.height - 84);
      ctx.fillStyle = "#e2e9e8";
      ctx.fillRect(48, 48, canvas.width - 96, canvas.height - 96);

      let drewFigure = false;
      if (sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
        ctx.drawImage(sourceCanvas, 72, 120, canvas.width - 144, 420);
        drewFigure = true;
      } else if (sourceSvg) {
        const image = await loadSvgImage(sourceSvg);
        if (image) {
          ctx.drawImage(image, 72, 120, canvas.width - 144, 420);
          drewFigure = true;
        }
      }

      if (!drewFigure) {
        ctx.fillStyle = "#F8EFD8";
        ctx.fillRect(72, 120, canvas.width - 144, 420);
        ctx.fillStyle = "#252D6B";
        ctx.font = "700 30px system-ui, sans-serif";
        wrapText(ctx, summary, 112, 210, canvas.width - 224, 44);
      }

      ctx.fillStyle = "#F78E42";
      ctx.font = "900 52px system-ui, sans-serif";
      wrapText(ctx, title, 72, 92, canvas.width - 144, 58);

      ctx.fillStyle = "#11100D";
      ctx.fillRect(72, 580, canvas.width - 144, 2);
      ctx.font = "900 28px system-ui, sans-serif";
      ctx.fillText("Quiver", 72, 638);
      ctx.font = "700 22px system-ui, sans-serif";
      ctx.fillText("quiversurf.app/learn", 190, 638);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (blob) downloadBlob(blob, "quiver-surf-science-figure.png");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => {
        void handleDownload();
      }}
      disabled={busy}
      className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md border-[1.5px] border-[#11100D] bg-[#FBF6E8] px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.18)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60 focus-ring"
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      {busy ? "Preparing" : "Download PNG"}
    </button>
  );
}
