export type PersonalityType = 'rookie' | 'local' | 'traveler' | 'photographer' | 'tactical' | 'competitor' | 'forecaster';
export type ActivityLevel = 'high' | 'medium' | 'low';

const POSTING_WINDOWS: Record<PersonalityType, { primary: [number, number]; secondary: [number, number] }> = {
  local: { primary: [5, 8], secondary: [16, 19] },
  rookie: { primary: [9, 12], secondary: [14, 17] },
  traveler: { primary: [7, 11], secondary: [15, 18] },
  photographer: { primary: [5, 7], secondary: [17, 20] },
  tactical: { primary: [5, 6], secondary: [11, 13] },
  competitor: { primary: [6, 9], secondary: [15, 18] },
  forecaster: { primary: [5, 6], secondary: [5, 6] }
};

export function isInPostingWindow(personality: PersonalityType, date: Date): boolean {
  const hour = date.getHours();
  const windows = POSTING_WINDOWS[personality];
  const [primaryStart, primaryEnd] = windows.primary;
  const [secondaryStart, secondaryEnd] = windows.secondary;
  return (hour >= primaryStart && hour < primaryEnd) || (hour >= secondaryStart && hour < secondaryEnd);
}

export function shouldPostNow(personality: PersonalityType, activityLevel: ActivityLevel, date: Date = new Date()): boolean {
  if (!isInPostingWindow(personality, date)) return false;
  const probability = { high: 0.15, medium: 0.08, low: 0.04 }[activityLevel];
  return Math.random() < probability;
}
