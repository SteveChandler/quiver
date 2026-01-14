export function formatWaveRange(heightFt: number): string {
  const lower = Math.max(0, Math.floor(heightFt - 0.5));
  const upper = Math.ceil(heightFt + 0.5);
  return lower + '-' + upper + 'ft';
}

export function formatWindDescription(speedKts: number, direction: string): string {
  if (speedKts <= 3) return 'glassy conditions';
  const intensity = speedKts <= 7 ? 'light' : speedKts <= 12 ? 'moderate' : 'breezy';
  return intensity + ' ' + direction.toUpperCase() + ' winds';
}

export function formatTideState(heightFt: number, isRising: boolean): string {
  const level = heightFt < 1 ? 'low' : heightFt < 3 ? 'mid' : 'high';
  return (isRising ? 'incoming' : 'dropping') + ' ' + level + '-tide';
}

export function formatWaterTemp(tempF: number): string {
  const rounded = Math.round(tempF);
  if (rounded <= 58) return rounded + '°F (bring rubber)';
  if (rounded <= 64) return rounded + '°F';
  return rounded + '°F (comfortable)';
}

export function formatCrowdSentence(level: number): string {
  if (level <= 1) return 'Lineup is basically empty.';
  if (level === 2) return 'Crowd is light with plenty of space.';
  if (level === 3) return 'Crowd is manageable, respectful vibe.';
  if (level === 4) return 'Busy lineup but friendly energy.';
  return 'Packed lineup—pick your moments.';
}

export function formatTimeOfDay(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return 'pre-dawn';
  if (hour < 7) return 'dawn patrol';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'late morning';
  if (hour < 17) return 'afternoon';
  if (hour < 20) return 'sunset session';
  return 'evening';
}
