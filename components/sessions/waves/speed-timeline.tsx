import type { SessionWave, SessionWavesResponse } from "@/lib/sessions/waves/waves-api-types";

interface SpeedTimelineProps {
  speedSeries: SessionWavesResponse["speedSeries"];
  waves: SessionWave[];
}

export function SpeedTimeline({ speedSeries, waves }: SpeedTimelineProps) {
  if (speedSeries.length < 2) return null;

  const times = speedSeries.map((point) => Date.parse(point.t));
  const start = Math.min(...times);
  const end = Math.max(...times);
  const maxSpeed = Math.max(1, ...speedSeries.map((point) => point.mps * 2.23694));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  const x = (time: number): number => 10 + ((time - start) / (end - start)) * 280;
  const path = speedSeries.map((point, index) => {
    const px = x(times[index]);
    const py = 92 - ((point.mps * 2.23694) / maxSpeed) * 78;
    return `${index === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 300 100" role="img" aria-label="Speed timeline" className="w-full rounded-lg bg-paper-deep/40">
      {waves.filter((wave) => !wave.excluded).map((wave) => {
        const left = Math.max(10, x(Date.parse(wave.startedAt)));
        const right = Math.min(290, x(Date.parse(wave.endedAt)));
        return <rect key={wave.id} x={left} y="0" width={Math.max(0, right - left)} height="100" fill="var(--q-orange)" opacity="0.2" />;
      })}
      <path d={path} fill="none" stroke="var(--q-orange)" strokeWidth="2.5" />
    </svg>
  );
}
