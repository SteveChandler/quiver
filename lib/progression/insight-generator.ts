export interface ProgressionData {
  skillTrends: Array<{
    skill: string;
    currentAvg: number;
    previousAvg: number;
    count: number;
  }>;
  forecastAccuracy: {
    current: number;
    previous: number;
  } | null;
  sweetSpot: {
    waveHeight: string;
    tide: string;
    wind: string;
    confidence: number;
    bestBeach?: string;
  } | null;
  sessionCount: number;
  totalHours: number;
}

export interface ProgressionInsight {
  type: 'skill_improvement' | 'forecast_accuracy' | 'sweet_spot' | 'volume' | 'streak';
  title: string;
  description: string;
  shareableText: string;
  priority: number;
}

const VOLUME_MILESTONES = [10, 25, 50, 100, 250, 500];
const MAX_INSIGHTS = 5;

export function generateInsights(data: ProgressionData): ProgressionInsight[] {
  const insights: ProgressionInsight[] = [];

  // 1. Skill improvement insights
  for (const trend of data.skillTrends) {
    const diff = trend.currentAvg - trend.previousAvg;
    if (diff > 0.5 && trend.count >= 3) {
      insights.push({
        type: 'skill_improvement',
        title: `${trend.skill} Improving`,
        description: `Your ${trend.skill} rating improved by ${diff.toFixed(1)} points over your last ${trend.count} sessions`,
        shareableText: `My ${trend.skill} improved by ${diff.toFixed(1)} points on Quiver!`,
        priority: diff * 10,
      });
    }
  }

  // 2. Forecast accuracy insight
  if (
    data.forecastAccuracy !== null &&
    data.forecastAccuracy.current > data.forecastAccuracy.previous
  ) {
    const { current, previous } = data.forecastAccuracy;
    const improvement = current - previous;
    insights.push({
      type: 'forecast_accuracy',
      title: 'Forecast Accuracy Up',
      description: `Forecast accuracy at your beaches improved by ${improvement.toFixed(0)}%`,
      shareableText: `Forecast accuracy improved ${improvement.toFixed(0)}% at my beaches on Quiver!`,
      priority: 8,
    });
  }

  // 3. Sweet spot insight
  if (data.sweetSpot !== null && data.sweetSpot.confidence > 0.5) {
    const { waveHeight, wind, confidence, bestBeach } = data.sweetSpot;
    const locationSuffix = bestBeach ? ` at ${bestBeach}` : '';
    insights.push({
      type: 'sweet_spot',
      title: 'Sweet Spot Found',
      description: `You rate sessions ${Math.round(confidence * 100)}% higher in ${waveHeight} waves with ${wind} wind${locationSuffix}`,
      shareableText: `I found my sweet spot: ${waveHeight} waves, ${wind} wind on Quiver!`,
      priority: 7,
    });
  }

  // 4. Volume milestone insight
  if (VOLUME_MILESTONES.includes(data.sessionCount)) {
    insights.push({
      type: 'volume',
      title: `${data.sessionCount} Sessions!`,
      description: `You've logged ${data.sessionCount} sessions totaling ${data.totalHours.toFixed(1)} hours`,
      shareableText: `Just hit ${data.sessionCount} surf sessions on Quiver!`,
      priority: 6,
    });
  }

  // Sort by priority descending and cap at max 5
  return insights.sort((a, b) => b.priority - a.priority).slice(0, MAX_INSIGHTS);
}
