import type { BreakDefinition, SimulationState, WaveDefinition } from "@/lib/play";

export interface CanvasScene {
  definition: BreakDefinition;
  wave: WaveDefinition;
  current: SimulationState;
  previous: SimulationState;
  interpolation: number;
  reducedMotion: boolean;
}

interface GradientCache {
  width: number;
  height: number;
  breakIndex: number;
  waveHeight: number;
  sky: CanvasGradient;
  ocean: CanvasGradient;
  face: CanvasGradient;
  foam: CanvasGradient;
  tube: CanvasGradient;
}

const gradientCache = new WeakMap<CanvasRenderingContext2D, GradientCache>();

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function cubic(from: number, controlA: number, controlB: number, to: number, amount: number): number {
  const inverse = 1 - amount;
  return inverse * inverse * inverse * from
    + 3 * inverse * inverse * amount * controlA
    + 3 * inverse * amount * amount * controlB
    + amount * amount * amount * to;
}

function getFaceHeight(height: number, scene: CanvasScene): number {
  const size = 0.34 + scene.definition.index * 0.075 + (scene.wave.height - 1) * 0.12;
  return height * clamp(size, 0.3, 0.74);
}

function isThrowing(wave: WaveDefinition, elapsed: number): boolean {
  for (let index = 0; index < wave.throwWindows.length; index += 1) {
    const window = wave.throwWindows[index];
    if (elapsed >= window.start && elapsed <= window.end) return true;
  }
  return false;
}

function getGradients(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CanvasScene,
  peakY: number,
): GradientCache {
  const cached = gradientCache.get(context);
  if (
    cached
    && cached.width === width
    && cached.height === height
    && cached.breakIndex === scene.definition.index
    && cached.waveHeight === scene.wave.height
  ) {
    return cached;
  }

  const sky = context.createLinearGradient(0, 0, 0, height * 0.62);
  sky.addColorStop(0, scene.definition.palette.skyTop);
  sky.addColorStop(1, scene.definition.palette.skyBottom);

  const ocean = context.createLinearGradient(0, height * 0.5, 0, height);
  ocean.addColorStop(0, scene.definition.palette.water);
  ocean.addColorStop(1, scene.definition.palette.waterDeep);

  const face = context.createLinearGradient(width * 0.28, peakY, width * 0.72, height * 0.9);
  face.addColorStop(0, scene.definition.palette.water);
  face.addColorStop(0.52, scene.definition.palette.waterDeep);
  face.addColorStop(1, "#071F3D");

  const foam = context.createLinearGradient(0, height * 0.38, width * 0.48, height * 0.68);
  foam.addColorStop(0, "rgba(127,167,184,0.94)");
  foam.addColorStop(0.58, "rgba(218,230,220,0.96)");
  foam.addColorStop(1, "rgba(245,238,220,0.99)");

  const faceHeight = height * 0.84 - peakY;
  const tubeX = width * 0.38;
  const tubeY = height * 0.84 - faceHeight * 0.24;
  const tube = context.createRadialGradient(
    tubeX + width * 0.095,
    tubeY,
    width * 0.005,
    tubeX + width * 0.055,
    tubeY,
    width * 0.2,
  );
  tube.addColorStop(0, scene.definition.palette.sun);
  tube.addColorStop(0.18, scene.definition.palette.water);
  tube.addColorStop(0.48, "rgba(11,58,117,0.9)");
  tube.addColorStop(1, "rgba(6,25,48,0.98)");

  const next: GradientCache = {
    width,
    height,
    breakIndex: scene.definition.index,
    waveHeight: scene.wave.height,
    sky,
    ocean,
    face,
    foam,
    tube,
  };
  gradientCache.set(context, next);
  return next;
}

function drawSky(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CanvasScene,
  gradients: GradientCache,
): void {
  const { definition, current, wave } = scene;
  context.fillStyle = gradients.sky;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.5;
  context.fillStyle = definition.palette.sun;
  context.beginPath();
  context.arc(width * 0.76, height * 0.2, Math.max(22, width * 0.045), 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const farDrift = current.elapsed * 2.4;
  context.fillStyle = "rgba(25,31,53,0.24)";
  context.beginPath();
  context.moveTo(0, height * 0.46);
  for (let x = 0; x <= width + 100; x += 100) {
    const ridge = height * (0.4 + 0.035 * Math.sin((x + farDrift) * 0.009 + wave.textureSeed));
    context.lineTo(x, ridge);
  }
  context.lineTo(width, height * 0.58);
  context.lineTo(0, height * 0.58);
  context.fill();

  const nearDrift = current.elapsed * 5;
  context.fillStyle = "rgba(13,16,32,0.42)";
  context.beginPath();
  context.moveTo(0, height * 0.52);
  for (let x = 0; x <= width + 80; x += 80) {
    const ridge = height * (0.46 + 0.045 * Math.sin((x + nearDrift) * 0.012 + wave.textureSeed));
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

function drawOcean(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CanvasScene,
  gradients: GradientCache,
): void {
  const shoulderY = height * 0.56;
  context.fillStyle = gradients.ocean;
  context.beginPath();
  context.moveTo(0, shoulderY);
  for (let x = 0; x <= width + 24; x += 24) {
    const ripple = Math.sin(x * 0.018 + scene.current.elapsed * 1.4) * height * 0.006;
    context.lineTo(x, shoulderY + ripple);
  }
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  context.globalAlpha = 0.24;
  context.strokeStyle = "#F5EEDC";
  context.lineWidth = 1.5;
  for (let index = 0; index < 12; index += 1) {
    const x = (index * 113 + scene.current.elapsed * 35) % width;
    const y = shoulderY + height * (0.06 + (index % 5) * 0.065);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 20 + (index % 3) * 8, y);
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawWaveFace(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CanvasScene,
  gradients: GradientCache,
  peakY: number,
  troughY: number,
  lipX: number,
): void {
  const shoulderY = height * 0.56;
  context.fillStyle = gradients.face;
  context.beginPath();
  context.moveTo(lipX, peakY);
  context.bezierCurveTo(
    width * 0.43,
    peakY + height * 0.03,
    width * 0.37,
    troughY - height * 0.04,
    width * 0.46,
    troughY,
  );
  context.bezierCurveTo(
    width * 0.6,
    troughY - height * 0.05,
    width * 0.75,
    shoulderY + height * 0.025,
    width,
    shoulderY,
  );
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.lineTo(0, shoulderY);
  context.closePath();
  context.fill();

  context.globalAlpha = 0.2;
  context.strokeStyle = "#F5EEDC";
  context.lineWidth = 1.4;
  for (let index = 1; index <= 4; index += 1) {
    const amount = index / 5;
    const lineY = peakY + (troughY - peakY) * amount;
    context.beginPath();
    context.moveTo(lipX + width * (0.02 + amount * 0.05), lineY);
    context.quadraticCurveTo(width * 0.56, lineY - height * 0.035, width * (0.72 + amount * 0.04), shoulderY + height * 0.025 * index);
    context.stroke();
  }
  context.globalAlpha = 1;

  context.strokeStyle = "rgba(245,238,220,0.92)";
  context.lineWidth = Math.max(3, width / 260);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(width, shoulderY);
  context.bezierCurveTo(width * 0.73, shoulderY - height * 0.035, width * 0.52, peakY + height * 0.08, lipX, peakY);
  context.quadraticCurveTo(lipX - width * 0.045, peakY + height * 0.015, lipX - width * 0.03, peakY + height * 0.08);
  context.stroke();

  context.globalAlpha = 0.42;
  context.strokeStyle = scene.definition.palette.water;
  context.lineWidth = Math.max(6, width / 120);
  context.beginPath();
  context.moveTo(lipX + width * 0.015, peakY + height * 0.02);
  context.quadraticCurveTo(lipX - width * 0.055, peakY + height * 0.02, lipX - width * 0.035, peakY + height * 0.11);
  context.stroke();
  context.globalAlpha = 1;
}

function drawTubeOpening(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  faceHeight: number,
  gradients: GradientCache,
): void {
  const centerX = width * 0.38;
  const centerY = height * 0.84 - faceHeight * 0.24;
  const radiusX = width * 0.13;
  const radiusY = Math.min(height * 0.22, faceHeight * 0.27);

  context.globalAlpha = 0.9;
  context.fillStyle = gradients.tube;
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, -0.08, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawSection(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CanvasScene,
  gradients: GradientCache,
  sectionX: number,
  peakY: number,
  troughY: number,
  urgency: number,
): void {
  const edgeTop = peakY + height * (0.035 + 0.02 * Math.sin(scene.current.elapsed * 3.2));
  context.fillStyle = gradients.foam;
  context.beginPath();
  context.moveTo(0, edgeTop - height * 0.02);
  for (let x = 0; x < sectionX; x += 34) {
    context.lineTo(x, edgeTop + Math.sin(x * 0.055 + scene.current.elapsed * 2.8) * height * 0.022);
  }
  context.lineTo(sectionX, edgeTop);
  context.bezierCurveTo(
    sectionX + width * 0.02,
    peakY + height * 0.14,
    sectionX - width * 0.035,
    troughY - height * 0.14,
    sectionX + width * 0.012,
    troughY,
  );
  context.lineTo(sectionX + width * 0.035, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgba(250,246,232,0.96)";
  context.lineWidth = Math.max(7, width / 105);
  context.beginPath();
  context.moveTo(sectionX, edgeTop);
  context.bezierCurveTo(
    sectionX + width * 0.02,
    peakY + height * 0.14,
    sectionX - width * 0.035,
    troughY - height * 0.14,
    sectionX + width * 0.012,
    troughY,
  );
  context.stroke();

  context.strokeStyle = "rgba(127,167,184,0.78)";
  context.lineWidth = Math.max(3, width / 260);
  context.beginPath();
  context.moveTo(sectionX - width * 0.012, edgeTop);
  context.bezierCurveTo(
    sectionX + width * 0.005,
    peakY + height * 0.18,
    sectionX - width * 0.05,
    troughY - height * 0.12,
    sectionX,
    troughY,
  );
  context.stroke();

  const particles = scene.reducedMotion ? 7 : 18 + Math.round(urgency * 14);
  context.fillStyle = "#F5EEDC";
  for (let index = 0; index < particles; index += 1) {
    const travel = (index * 29 + scene.current.elapsed * (24 + urgency * 45)) % (width * 0.16);
    const x = sectionX + travel;
    const y = edgeTop + (index % 7) * (troughY - edgeTop) * 0.065 - travel * 0.18;
    context.globalAlpha = 0.35 + (index % 4) * 0.14;
    context.beginPath();
    context.arc(x, y, 1.2 + (index % 3), 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawSpeedAndWake(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CanvasScene,
  surferX: number,
  surferY: number,
): void {
  if (scene.current.speed < 42) return;
  const amount = clamp((scene.current.speed - 42) / 58, 0, 1);
  const lines = scene.reducedMotion ? 4 : 7;
  context.strokeStyle = "rgba(245,238,220,0.58)";
  context.lineWidth = Math.max(1.5, width / 500);
  for (let index = 0; index < lines; index += 1) {
    const y = surferY + height * (0.005 + index * 0.012);
    const length = width * (0.035 + amount * 0.055 + index * 0.007);
    context.beginPath();
    context.moveTo(surferX - width * 0.025 - index * 5, y);
    context.lineTo(surferX - length - index * 8, y + index * 1.5);
    context.stroke();
  }

  context.globalAlpha = 0.52 + amount * 0.25;
  context.strokeStyle = "#F5EEDC";
  context.lineWidth = Math.max(2, width / 330);
  context.beginPath();
  context.moveTo(surferX - width * 0.01, surferY + height * 0.018);
  context.quadraticCurveTo(
    surferX - width * 0.075,
    surferY + height * 0.035,
    surferX - width * (0.13 + amount * 0.06),
    surferY + height * 0.015,
  );
  context.stroke();
  context.globalAlpha = 1;
}

function drawRider(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CanvasScene,
  facePosition: number,
  surferX: number,
  surferY: number,
): void {
  const { current } = scene;
  const unit = Math.max(0.82, Math.min(width / 900, height / 560));
  const airProgress = current.phase === "airborne"
    ? clamp(current.phaseElapsed / 0.31, 0, 1)
    : 0;
  const airLift = current.phase === "airborne"
    ? Math.sin(airProgress * Math.PI) * height * 0.16
    : 0;
  const y = surferY - airLift;
  const isRiding = current.phase === "riding" || current.phase === "airborne";

  context.save();
  context.translate(surferX, y);
  const boardAngle = (0.48 - facePosition) * 0.24;
  context.rotate(current.phase === "airborne" ? boardAngle + airProgress * Math.PI * 2 : boardAngle);

  context.strokeStyle = "#11100D";
  context.lineWidth = 7 * unit;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-31 * unit, 7 * unit);
  context.quadraticCurveTo(0, 12 * unit, 32 * unit, 4 * unit);
  context.stroke();
  context.strokeStyle = "#F5EEDC";
  context.lineWidth = 4.5 * unit;
  context.stroke();

  if (!isRiding) {
    context.strokeStyle = "#11100D";
    context.lineWidth = 5 * unit;
    context.beginPath();
    context.moveTo(-12 * unit, 0);
    context.lineTo(8 * unit, -5 * unit);
    context.lineTo(24 * unit, -1 * unit);
    context.moveTo(-2 * unit, -3 * unit);
    context.lineTo(-18 * unit, -9 * unit);
    context.stroke();
    context.fillStyle = "#11100D";
    context.beginPath();
    context.arc(14 * unit, -8 * unit, 5.5 * unit, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  const crouched = current.inBarrel || current.phase === "airborne";
  const lean = (current.speed / 100 - 0.45) * 8 * unit + (0.5 - facePosition) * 4 * unit;
  const hipX = crouched ? -2 * unit : 0;
  const hipY = crouched ? -7 * unit : -14 * unit;
  const shoulderX = crouched ? 10 * unit : lean;
  const shoulderY = crouched ? -19 * unit : -37 * unit;
  const headX = shoulderX + (crouched ? 7 : 2) * unit;
  const headY = shoulderY - 9 * unit;

  context.strokeStyle = "#11100D";
  context.lineWidth = 5.5 * unit;
  context.beginPath();
  context.moveTo(hipX, hipY);
  context.lineTo(shoulderX, shoulderY);
  context.moveTo(hipX, hipY);
  context.lineTo(-14 * unit, 5 * unit);
  context.moveTo(hipX, hipY);
  context.lineTo(17 * unit, 3 * unit);
  context.moveTo(shoulderX, shoulderY + 5 * unit);
  context.lineTo((crouched ? -11 : -17) * unit, (crouched ? -11 : -25) * unit);
  context.moveTo(shoulderX, shoulderY + 5 * unit);
  context.lineTo((crouched ? 24 : 22) * unit, (crouched ? -11 : -29) * unit);
  context.stroke();

  context.strokeStyle = "#F78E42";
  context.lineWidth = 4 * unit;
  context.beginPath();
  context.moveTo(hipX, hipY);
  context.lineTo(shoulderX, shoulderY);
  context.stroke();

  context.fillStyle = "#11100D";
  context.beginPath();
  context.arc(headX, headY, 6 * unit, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawManeuverSpray(
  context: CanvasRenderingContext2D,
  width: number,
  scene: CanvasScene,
  surferX: number,
  surferY: number,
): void {
  const recent = scene.current.stats.maneuvers.at(-1);
  if (!recent || recent.type === "barrel") return;
  const age = scene.current.elapsed - recent.at;
  if (age < 0 || age > 0.8) return;

  const particles = scene.reducedMotion ? 5 : 18;
  const direction = recent.type === "snap" ? -1 : 1;
  context.fillStyle = "#F5EEDC";
  for (let index = 0; index < particles; index += 1) {
    const angle = direction * (0.28 + index * 0.13);
    const radius = (10 + index * 2.2) * (1 + age * 2.4);
    context.globalAlpha = clamp(0.86 - age + (index % 3) * 0.04, 0, 1);
    context.beginPath();
    context.arc(
      surferX - Math.cos(angle) * radius,
      surferY - Math.sin(angle) * radius * 0.8,
      1.4 + (index % 3),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawTubeLip(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  faceHeight: number,
  peakY: number,
  lipX: number,
  scene: CanvasScene,
): void {
  const centerX = width * 0.38;
  const centerY = height * 0.84 - faceHeight * 0.24;
  const radiusX = width * 0.13;
  const radiusY = Math.min(height * 0.22, faceHeight * 0.27);

  context.strokeStyle = scene.definition.palette.water;
  context.lineWidth = Math.max(18, width * 0.034);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(lipX, peakY + height * 0.01);
  context.bezierCurveTo(
    centerX + radiusX * 0.35,
    peakY - height * 0.005,
    centerX + radiusX * 0.9,
    centerY - radiusY * 0.45,
    centerX + radiusX * 0.5,
    centerY + radiusY * 0.48,
  );
  context.stroke();

  context.strokeStyle = "rgba(250,246,232,0.96)";
  context.lineWidth = Math.max(5, width * 0.009);
  context.beginPath();
  context.moveTo(lipX - width * 0.01, peakY);
  context.bezierCurveTo(
    centerX + radiusX * 0.35,
    peakY - height * 0.01,
    centerX + radiusX,
    centerY - radiusY * 0.5,
    centerX + radiusX * 0.55,
    centerY + radiusY * 0.48,
  );
  context.stroke();
}

function drawUrgency(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  urgency: number,
): void {
  if (urgency <= 0) return;
  context.globalAlpha = urgency * 0.3;
  context.strokeStyle = "#07111F";
  context.lineWidth = Math.max(12, Math.min(width, height) * 0.05);
  context.strokeRect(0, 0, width, height);
  context.globalAlpha = 1;
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
    width * 0.48,
    height * 0.3 - (1 - alpha) * 28,
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
  context.globalAlpha = 0.88 * fade;
  context.fillStyle = "#0D1020";
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;

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
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

  const facePosition = lerp(scene.previous.facePosition, scene.current.facePosition, scene.interpolation);
  const sectionDistance = lerp(scene.previous.sectionDistance, scene.current.sectionDistance, scene.interpolation);
  const faceHeight = getFaceHeight(height, scene);
  const troughY = height * 0.84;
  const peakY = troughY - faceHeight;
  const lipX = width * 0.3;
  const surferX = cubic(width * 0.39, width * 0.41, width * 0.39, width * 0.32, facePosition);
  const surferY = cubic(
    troughY,
    troughY - faceHeight * 0.46,
    peakY + faceHeight * 0.16,
    peakY + height * 0.045,
    facePosition,
  );
  const sectionX = surferX - sectionDistance * width * 0.22;
  const urgency = clamp((0.38 - sectionDistance) / 0.38, 0, 1);
  const throwing = isThrowing(scene.wave, scene.current.elapsed);
  const gradients = getGradients(context, width, height, scene, peakY);
  const shake = !scene.reducedMotion && scene.current.phase === "wipeout" && scene.current.phaseElapsed < 0.45
    ? 7 * (1 - scene.current.phaseElapsed / 0.45)
    : 0;

  context.save();
  context.translate(
    shake ? Math.sin(scene.current.phaseElapsed * 91) * shake : 0,
    shake ? Math.cos(scene.current.phaseElapsed * 73) * shake : 0,
  );
  drawSky(context, width, height, scene, gradients);
  drawOcean(context, width, height, scene, gradients);
  drawWaveFace(context, width, height, scene, gradients, peakY, troughY, lipX);
  if (throwing) drawTubeOpening(context, width, height, faceHeight, gradients);
  drawSection(context, width, height, scene, gradients, sectionX, peakY, troughY, urgency);
  drawSpeedAndWake(context, width, height, scene, surferX, surferY);
  drawRider(context, width, height, scene, facePosition, surferX, surferY);
  if (throwing) drawTubeLip(context, width, height, faceHeight, peakY, lipX, scene);
  drawManeuverSpray(context, width, scene, surferX, surferY);
  drawScorePopup(context, width, height, scene.current);
  drawUrgency(context, width, height, urgency);
  drawUnderwater(context, width, height, scene.current, scene.reducedMotion);
  context.restore();
}
