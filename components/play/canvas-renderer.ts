import type { BreakDefinition, SimulationState, WaveDefinition } from "@/lib/play";

export interface CanvasScene {
  definition: BreakDefinition;
  wave: WaveDefinition;
  current: SimulationState;
  previous: SimulationState;
  interpolation: number;
  reducedMotion: boolean;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function drawSky(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CanvasScene,
): void {
  const { definition, current, wave } = scene;
  const gradient = context.createLinearGradient(0, 0, 0, height * 0.7);
  gradient.addColorStop(0, definition.palette.skyTop);
  gradient.addColorStop(1, definition.palette.skyBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.52;
  context.fillStyle = definition.palette.sun;
  context.beginPath();
  context.arc(width * 0.76, height * 0.23, Math.max(22, width * 0.045), 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const drift = current.elapsed * 5;
  context.fillStyle = "rgba(13,16,32,0.38)";
  context.beginPath();
  context.moveTo(0, height * 0.49);
  for (let x = 0; x <= width + 80; x += 80) {
    const ridge = height * (0.42 + 0.05 * Math.sin((x + drift) * 0.012 + wave.textureSeed));
    context.lineTo(x, ridge);
  }
  context.lineTo(width, height * 0.62);
  context.lineTo(0, height * 0.62);
  context.fill();

  if (definition.index !== 5) return;
  context.strokeStyle = "rgba(244,235,216,0.28)";
  context.lineWidth = 1;
  for (let index = 0; index < 32; index += 1) {
    const x = ((index * 73 + current.elapsed * 170) % (width + 80)) - 40;
    const y = (index * 47) % (height * 0.58);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - 8, y + 22);
    context.stroke();
  }
}

function waveY(x: number, width: number, height: number, elapsed: number, heightScale: number): number {
  const swell = Math.sin((x / width) * Math.PI * 3.2 + elapsed * 1.5) * height * 0.018;
  return height * (0.62 - heightScale * 0.06) + swell;
}

function drawOcean(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CanvasScene,
): void {
  const { definition, wave, current } = scene;
  const surface = waveY(0, width, height, current.elapsed, wave.height);
  const gradient = context.createLinearGradient(0, surface, 0, height);
  gradient.addColorStop(0, definition.palette.water);
  gradient.addColorStop(1, definition.palette.waterDeep);
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(0, surface);
  for (let x = 0; x <= width + 20; x += 20) {
    context.lineTo(x, waveY(x, width, height, current.elapsed, wave.height));
  }
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgba(245,238,220,0.72)";
  context.lineWidth = Math.max(2, width / 300);
  context.beginPath();
  for (let x = 0; x <= width; x += 16) {
    const y = waveY(x, width, height, current.elapsed, wave.height);
    if (x === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();

  context.fillStyle = "rgba(245,238,220,0.3)";
  for (let index = 0; index < 20; index += 1) {
    const x = (index * 89 + current.elapsed * 70) % width;
    const y = surface + 24 + (index % 5) * height * 0.045;
    context.fillRect(x, y, 18 + (index % 3) * 8, 1.5);
  }
}

function drawSection(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sectionDistance: number,
): void {
  const surferX = width * 0.32;
  const sectionX = surferX - sectionDistance * width * 0.78;
  const gradient = context.createLinearGradient(sectionX, height * 0.28, sectionX + width * 0.18, height * 0.72);
  gradient.addColorStop(0, "rgba(245,238,220,0.92)");
  gradient.addColorStop(0.25, "rgba(127,167,184,0.86)");
  gradient.addColorStop(1, "rgba(11,58,117,0.12)");
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(sectionX - width * 0.08, height * 0.68);
  context.quadraticCurveTo(sectionX, height * 0.23, sectionX + width * 0.18, height * 0.65);
  context.lineTo(sectionX + width * 0.2, height);
  context.lineTo(sectionX - width * 0.12, height);
  context.closePath();
  context.fill();
}

function drawSurfer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CanvasScene,
  facePosition: number,
): void {
  const { current } = scene;
  const x = width * 0.32;
  const baseY = height * 0.84 - facePosition * height * 0.32;
  const airLift = current.phase === "airborne"
    ? Math.sin(Math.min(1, current.phaseElapsed / 0.32) * Math.PI) * height * 0.12
    : 0;
  const y = baseY - airLift;

  context.strokeStyle = "rgba(245,238,220,0.44)";
  context.lineWidth = 1.5;
  for (let index = 0; index < 6; index += 1) {
    context.beginPath();
    context.moveTo(x - 20 - index * 18, y + 10 + index * 1.5);
    context.lineTo(x - 8 - index * 18, y + 10 + index * 1.5);
    context.stroke();
  }

  context.save();
  context.translate(x, y);
  context.rotate((0.45 - facePosition) * 0.35);
  context.strokeStyle = "#F5EEDC";
  context.lineCap = "round";
  context.lineWidth = Math.max(2, width / 280);
  context.beginPath();
  context.moveTo(-18, 8);
  context.quadraticCurveTo(0, 13, 25, 5);
  context.stroke();

  context.strokeStyle = "#11100D";
  context.lineWidth = Math.max(3, width / 220);
  context.beginPath();
  context.moveTo(0, -12);
  context.lineTo(1, 2);
  context.lineTo(-10, 9);
  context.moveTo(1, 2);
  context.lineTo(14, 8);
  context.moveTo(0, -7);
  context.lineTo(-11, 0);
  context.moveTo(0, -7);
  context.lineTo(12, -2);
  context.stroke();
  context.fillStyle = "#11100D";
  context.beginPath();
  context.arc(0, -17, 5, 0, Math.PI * 2);
  context.fill();
  context.restore();

  const recent = current.stats.maneuvers.at(-1);
  if (!recent || current.elapsed - recent.at > 0.75) return;
  context.fillStyle = "rgba(245,238,220,0.78)";
  const particles = scene.reducedMotion ? 5 : 18;
  for (let index = 0; index < particles; index += 1) {
    const age = current.elapsed - recent.at;
    const angle = index * 2.4 + recent.at;
    const radius = (10 + index * 2) * (1 + age);
    context.beginPath();
    context.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * 0.55, 1.5, 0, Math.PI * 2);
    context.fill();
  }
}

function drawScorePopup(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SimulationState,
): void {
  const maneuver = state.stats.maneuvers.at(-1);
  if (!maneuver || state.elapsed - maneuver.at > 1) return;
  const alpha = 1 - (state.elapsed - maneuver.at);
  context.globalAlpha = alpha;
  context.fillStyle = "#F5EEDC";
  context.font = `900 ${Math.max(14, width * 0.026)}px Space Mono, monospace`;
  context.textAlign = "center";
  context.fillText(
    `${maneuver.type.toUpperCase()} +${maneuver.awardedPoints.toFixed(1)}`,
    width * 0.42,
    height * 0.36 - (1 - alpha) * 28,
  );
  context.globalAlpha = 1;
}

function drawUnderwater(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SimulationState,
  reducedMotion: boolean,
): void {
  if (state.phase !== "wipeout") return;
  const fade = Math.min(1, state.phaseElapsed * 2.5);
  context.fillStyle = `rgba(13,16,32,${0.88 * fade})`;
  context.fillRect(0, 0, width, height);

  const particleCount = reducedMotion ? 10 : 38;
  context.fillStyle = "rgba(242,201,76,0.7)";
  for (let index = 0; index < particleCount; index += 1) {
    const x = (index * 97 + Math.sin(index + state.phaseElapsed) * 24) % width;
    const y = (index * 53 - state.phaseElapsed * (8 + index % 5) + height * 2) % height;
    context.beginPath();
    context.arc(x, y, 1 + (index % 3), 0, Math.PI * 2);
    context.fill();
  }

  const meterWidth = Math.min(280, width * 0.62);
  const meterX = (width - meterWidth) / 2;
  const progress = Math.min(1, state.phaseElapsed / 4);
  context.strokeStyle = "rgba(245,238,220,0.75)";
  context.strokeRect(meterX, height * 0.82, meterWidth, 12);
  context.fillStyle = "#F2C94C";
  context.fillRect(meterX + 2, height * 0.82 + 2, (meterWidth - 4) * progress, 8);
  context.fillStyle = "#F5EEDC";
  context.font = `700 ${Math.max(11, width * 0.018)}px Space Mono, monospace`;
  context.textAlign = "center";
  context.fillText("HOLD DOWN · BREATHE", width / 2, height * 0.79);
}

export function renderCanvasScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CanvasScene,
): void {
  const facePosition = lerp(
    scene.previous.facePosition,
    scene.current.facePosition,
    scene.interpolation,
  );
  const sectionDistance = lerp(
    scene.previous.sectionDistance,
    scene.current.sectionDistance,
    scene.interpolation,
  );
  const shake = !scene.reducedMotion && scene.current.phase === "wipeout" && scene.current.phaseElapsed < 0.45
    ? 7 * (1 - scene.current.phaseElapsed / 0.45)
    : 0;

  context.save();
  context.translate(
    shake ? Math.sin(scene.current.phaseElapsed * 91) * shake : 0,
    shake ? Math.cos(scene.current.phaseElapsed * 73) * shake : 0,
  );
  drawSky(context, width, height, scene);
  drawOcean(context, width, height, scene);
  drawSection(context, width, height, sectionDistance);
  drawSurfer(context, width, height, scene, facePosition);
  drawScorePopup(context, width, height, scene.current);
  drawUnderwater(context, width, height, scene.current, scene.reducedMotion);
  context.restore();
}
