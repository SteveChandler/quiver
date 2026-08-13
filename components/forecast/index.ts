/**
 * Forecast Components Export Index
 *
 * Centralized exports for all forecast-related components
 */

// Tide Chart Components
export { TideChart } from './tide-chart-recharts';
export type { TidePoint, TideChartProps } from './tide-chart-recharts';

// Forecast Transparency & Verification Components
export { ForecastVerificationWidget } from './forecast-verification-widget';
export { ForecastAccuracyStats } from './forecast-accuracy-stats';
export { BuoyStationLink } from './buoy-station-link';
export type { BuoyStationLinkProps } from './buoy-station-link';

// Regional Forecast Components
export { BestDaysSection } from './best-days-section';
export type { BestDaysSectionProps } from './best-days-section';

// Swell Event Components
export { SwellEventCard, SwellEventList } from './swell-event-card';
export type { SwellEventCardProps, SwellEventListProps } from './swell-event-card';

// Beach Conditions Components
export { BeachConditionsGrid } from './beach-conditions-grid';
export type { BeachConditionsGridProps } from './beach-conditions-grid';

// Regional Forecast Card Components
export { RegionalForecastCard, RegionalForecastCardGrid } from './regional-forecast-card';
export type { RegionalForecastCardProps } from './regional-forecast-card';

// Score Badge Component
export { ScoreBadge } from './score-badge';
export type { ScoreBadgeProps } from './score-badge';

// Animated Score Gauge Component
export { AnimatedScoreGauge } from './animated-score-gauge';
export type { AnimatedScoreGaugeProps } from './animated-score-gauge';

// Top-ranked beach hero
export { TopRankedBeachHero } from './top-ranked-beach-hero';

// Wave Sparkline Component
export { WaveSparkline, createSparklineData } from './wave-sparkline';
export type { WaveSparklineProps, SparklineDataPoint } from './wave-sparkline';

// Swell Wave Chart Component
export { SwellWaveChart, SwellIndicator } from './swell-wave-chart';
export type { SwellWaveChartProps } from './swell-wave-chart';

// Forecast Skeleton Components
export {
  HeroSkeleton,
  CardGridSkeleton,
  CardSkeleton,
  TableSkeleton,
  TimelineSkeleton,
  WaveShimmer,
  ForecastPageSkeleton,
} from './forecast-skeleton';

// Best Right Now Leaderboard
export { BestRightNow } from './best-right-now';

// Layout Components
export { ForecastSectionContainer } from './forecast-section-container';

// Re-export types from regional-forecast-utils for convenience
export type {
  DaySummary,
  SwellEvent,
  BeachConditionSummary,
  RegionalForecastSummary,
} from '@/lib/utils/regional-forecast-utils';
