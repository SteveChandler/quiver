/**
 * PersonalizedBadge Examples
 *
 * This file demonstrates all the ways to use the enhanced PersonalizedBadge component.
 * These examples can be used in Storybook or as a reference for implementation.
 */

import { PersonalizedBadge } from './PersonalizedBadge';

/**
 * Example 1: Score Mode (Default) - Recommended
 *
 * Shows the personalization score as a percentage with color coding.
 * Desktop: Hover tooltip shows breakdown
 * Mobile: Tap to expand breakdown
 */
export function ScoreModeExample() {
  return (
    <PersonalizedBadge
      personalized={true}
      score={92}
      breakdown={{
        base: 75,
        onboardingPrefs: 10,
        learnedPrefs: 5,
        affinity: 2,
      }}
    />
  );
}

/**
 * Example 2: High Score with Glow Effect
 *
 * Scores >= 85 get a primary variant with subtle glow effect
 */
export function HighScoreExample() {
  return (
    <PersonalizedBadge
      personalized={true}
      score={88}
      breakdown={{
        base: 70,
        onboardingPrefs: 12,
        learnedPrefs: 6,
        affinity: 0,
      }}
    />
  );
}

/**
 * Example 3: Medium Score (70-84)
 *
 * Ocean blue variant for good matches
 */
export function MediumScoreExample() {
  return (
    <PersonalizedBadge
      personalized={true}
      score={75}
      breakdown={{
        base: 65,
        onboardingPrefs: 8,
        learnedPrefs: 2,
        affinity: 0,
      }}
    />
  );
}

/**
 * Example 4: Low Score (50-69)
 *
 * Secondary/muted variant for moderate matches
 */
export function LowScoreExample() {
  return (
    <PersonalizedBadge
      personalized={true}
      score={62}
      breakdown={{
        base: 55,
        onboardingPrefs: 5,
        learnedPrefs: 2,
        affinity: 0,
      }}
    />
  );
}

/**
 * Example 5: Very Low Score (< 50)
 *
 * Outline variant for weak matches
 */
export function VeryLowScoreExample() {
  return (
    <PersonalizedBadge
      personalized={true}
      score={45}
      breakdown={{
        base: 40,
        onboardingPrefs: 3,
        learnedPrefs: 2,
        affinity: 0,
      }}
    />
  );
}

/**
 * Example 6: Compact Mode
 *
 * Just shows "Personalized" without the score.
 * Useful when space is limited.
 */
export function CompactModeExample() {
  return (
    <PersonalizedBadge
      personalized={true}
      displayMode="compact"
    />
  );
}

/**
 * Example 7: With Delta Indicator
 *
 * Shows improvement over base score ("+13 for you")
 */
export function WithDeltaExample() {
  return (
    <PersonalizedBadge
      personalized={true}
      score={88}
      baseScore={75}
      showDelta={true}
      breakdown={{
        base: 75,
        onboardingPrefs: 10,
        learnedPrefs: 3,
        affinity: 0,
      }}
    />
  );
}

/**
 * Example 8: With Beach Affinity Badge
 *
 * Shows both personalization score and affinity badge
 */
export function WithAffinityExample() {
  return (
    <PersonalizedBadge
      personalized={true}
      score={95}
      breakdown={{
        base: 75,
        onboardingPrefs: 10,
        learnedPrefs: 5,
        affinity: 5,
      }}
      affinityData={{
        sessionCount: 15,
        lastSurfed: new Date('2025-11-01'),
      }}
    />
  );
}

/**
 * Example 9: Small Size Variant
 *
 * Useful for compact layouts or mobile views
 */
export function SmallSizeExample() {
  return (
    <PersonalizedBadge
      personalized={true}
      score={92}
      size="sm"
      breakdown={{
        base: 75,
        onboardingPrefs: 10,
        learnedPrefs: 5,
        affinity: 2,
      }}
    />
  );
}

/**
 * Example 10: Large Size Variant
 *
 * Useful for hero sections or prominent placements
 */
export function LargeSizeExample() {
  return (
    <PersonalizedBadge
      personalized={true}
      score={92}
      size="lg"
      breakdown={{
        base: 75,
        onboardingPrefs: 10,
        learnedPrefs: 5,
        affinity: 2,
      }}
    />
  );
}

/**
 * Example 11: No Breakdown Data
 *
 * Still shows the score without detailed breakdown
 */
export function NoBreakdownExample() {
  return (
    <PersonalizedBadge
      personalized={true}
      score={87}
    />
  );
}

/**
 * Example 12: Not Personalized
 *
 * Component returns null and shows nothing
 */
export function NotPersonalizedExample() {
  return (
    <PersonalizedBadge
      personalized={false}
      score={75}
    />
  );
  // This renders nothing
}

/**
 * Example 13: All Features Combined
 *
 * Maximum configuration showing all available features
 */
export function FullFeaturesExample() {
  return (
    <div className="space-y-4">
      {/* High score with all features */}
      <PersonalizedBadge
        personalized={true}
        score={95}
        baseScore={80}
        showDelta={true}
        size="lg"
        breakdown={{
          base: 80,
          onboardingPrefs: 10,
          learnedPrefs: 3,
          affinity: 2,
        }}
        affinityData={{
          sessionCount: 23,
          lastSurfed: new Date('2025-11-10'),
        }}
      />

      {/* Medium score, medium size */}
      <PersonalizedBadge
        personalized={true}
        score={72}
        size="md"
        breakdown={{
          base: 65,
          onboardingPrefs: 5,
          learnedPrefs: 2,
          affinity: 0,
        }}
      />

      {/* Compact mode for tight spaces */}
      <PersonalizedBadge
        personalized={true}
        displayMode="compact"
        size="sm"
      />
    </div>
  );
}

/**
 * Example 14: Real-World Usage in Beach Card
 *
 * How the badge would typically be used in a beach recommendation card
 */
export function BeachCardExample() {
  // This would come from your API/recommendation engine
  const recommendationData = {
    beachName: "Huntington Beach",
    score: 92,
    personalized: true,
    breakdown: {
      base: 75,
      onboardingPrefs: 10,
      learnedPrefs: 5,
      affinity: 2,
    },
    affinityData: {
      sessionCount: 15,
      lastSurfed: new Date('2025-11-01'),
    },
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      {/* Beach header */}
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold">
          {recommendationData.beachName}
        </h3>
        <PersonalizedBadge
          personalized={recommendationData.personalized}
          score={recommendationData.score}
          breakdown={recommendationData.breakdown}
          affinityData={recommendationData.affinityData}
          size="sm"
        />
      </div>

      {/* Beach details would go here */}
      <div className="text-sm text-muted-foreground">
        Perfect conditions today • 4-6ft waves
      </div>
    </div>
  );
}

/**
 * Example 15: Testing Different Score Thresholds
 *
 * Visual demonstration of color coding across all score ranges
 */
export function ScoreThresholdsExample() {
  const scores = [
    { score: 95, label: "Excellent (≥85)" },
    { score: 84, label: "Good (70-84)" },
    { score: 70, label: "Good (70-84)" },
    { score: 69, label: "Fair (50-69)" },
    { score: 50, label: "Fair (50-69)" },
    { score: 49, label: "Low (<50)" },
    { score: 30, label: "Low (<50)" },
  ];

  return (
    <div className="space-y-3">
      {scores.map((item) => (
        <div key={item.score} className="flex items-center gap-4">
          <PersonalizedBadge
            personalized={true}
            score={item.score}
            breakdown={{
              base: item.score - 10,
              onboardingPrefs: 8,
              learnedPrefs: 2,
              affinity: 0,
            }}
          />
          <span className="text-sm text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
