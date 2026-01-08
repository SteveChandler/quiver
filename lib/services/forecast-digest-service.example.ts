/**
 * Example usage of Forecast Digest Service
 *
 * This file demonstrates how to use the forecast digest service
 * for daily digest email generation.
 */

import { evaluateDigestMatch } from '@/lib/services/forecast-digest-service';
import type {
  BeachMetadata,
  EnhancedForecastEntity,
} from '@/lib/services/magic-hour-finder';

/**
 * Example: Evaluate a beach for daily digest inclusion
 */
async function exampleDigestEvaluation() {
  // 1. Fetch user profile with skill level
  const userProfile = {
    id: 'user-123',
    skill_level: 'intermediate',
  };

  // 2. Fetch user's learned preferences (optional)
  const userPrefs = {
    wave_min_ft: 3,
    wave_max_ft: 6,
    max_wind_mph: 15,
    preferred_tide_statuses: ['rising', 'high'],
  };

  // 3. Fetch beach metadata
  const beach: BeachMetadata = {
    id: 'beach-123',
    name: 'Ocean Beach',
    slug: 'ocean-beach',
    skill_level: 'intermediate',
    swell_window_center_deg: 270, // W
    swell_window_halfwidth_deg: 45,
    wind_offshore_deg: 90, // E
    wind_offshore_tol_deg: 30,
    preferred_tide_ft_min: 2,
    preferred_tide_ft_max: 5,
  };

  // 4. Fetch forecasts from cache (next 48 hours)
  const forecasts: EnhancedForecastEntity[] = [
    // ... forecasts from getFreshForecastFromCache()
  ];

  // 5. Evaluate match
  const result = evaluateDigestMatch(
    forecasts,
    beach,
    userProfile.skill_level,
    userPrefs
  );

  // 6. Use result to build digest email
  if (result.isMatch) {
    console.log(`✓ ${beach.name} matches!`);
    console.log(`Match Quality: ${result.matchQuality}`);
    console.log(`Best Window: ${result.bestWindow?.windowStart} - ${result.bestWindow?.windowEnd}`);
    console.log(`\nWhy Text:`);
    result.whyText.forEach((text) => console.log(`  - ${text}`));

    if (result.crowdWarning) {
      console.log(`\n⚠ ${result.crowdWarning}`);
    }

    return {
      beachId: beach.id,
      beachName: beach.name,
      matchQuality: result.matchQuality,
      peakTime: result.bestWindow?.peakTime,
      windowStart: result.bestWindow?.windowStart,
      windowEnd: result.bestWindow?.windowEnd,
      whyText: result.whyText,
      crowdWarning: result.crowdWarning,
    };
  } else {
    console.log(`✗ ${beach.name} does not match`);
    console.log(`Skill Gate: ${result.skillGate.reason}`);
    console.log(`Swell Gate: ${result.swellGate.reason}`);
    console.log(`Wind Gate: ${result.windGate.reason}`);
    return null;
  }
}

/**
 * Example: Cron job pattern for daily digest
 */
async function exampleDailyDigestCron() {
  // 1. Get all users with digest enabled
  const users = await getUsersWithDigestEnabled();

  // 2. For each user, evaluate their candidate beaches
  for (const user of users) {
    const candidateBeaches = await getCandidateBeaches(user.id);
    const matches = [];

    for (const beach of candidateBeaches) {
      const forecasts = await getForecastsFromCache(beach.id);
      const result = evaluateDigestMatch(
        forecasts,
        beach,
        user.skill_level,
        user.preferences
      );

      if (result.isMatch) {
        matches.push({
          beach,
          result,
        });
      }
    }

    // 3. Sort by match quality and select top recommendations
    matches.sort((a, b) => {
      const qualityOrder = {
        perfect: 0,
        excellent: 1,
        good: 2,
        fair: 3,
        no_match: 4,
      };
      return qualityOrder[a.result.matchQuality] - qualityOrder[b.result.matchQuality];
    });

    const topMatches = matches.slice(0, 3); // Top 3 recommendations

    // 4. Send digest email
    if (topMatches.length > 0) {
      await sendDigestEmail(user, topMatches);
    }
  }
}

/**
 * Helper: Build email HTML from digest results
 */
function buildDigestEmailHTML(
  matches: Array<{
    beach: BeachMetadata;
    result: ReturnType<typeof evaluateDigestMatch>;
  }>
): string {
  const matchesHTML = matches
    .map((match) => {
      const { beach, result } = match;
      return `
        <div class="recommendation">
          <h2>${beach.name}</h2>
          <p class="quality">${result.matchQuality.toUpperCase()}</p>
          <p class="window">
            Best Window: ${result.bestWindow?.windowStart} - ${result.bestWindow?.windowEnd}
          </p>
          <div class="why">
            ${result.whyText.map((text) => `<p>${text}</p>`).join('')}
          </div>
          ${
            result.crowdWarning
              ? `<p class="warning">${result.crowdWarning}</p>`
              : ''
          }
          <a href="https://quiver.surf/beach/${beach.slug}">View Forecast</a>
        </div>
      `;
    })
    .join('');

  return `
    <html>
      <body>
        <h1>Your Daily Surf Digest</h1>
        ${matchesHTML}
      </body>
    </html>
  `;
}

// Placeholder functions (implement in actual cron job)
async function getUsersWithDigestEnabled(): Promise<any[]> {
  return [];
}

async function getCandidateBeaches(userId: string): Promise<BeachMetadata[]> {
  return [];
}

async function getForecastsFromCache(
  beachId: string
): Promise<EnhancedForecastEntity[]> {
  return [];
}

async function sendDigestEmail(user: any, matches: any[]): Promise<void> {
  // Implement email sending
}

export {
  exampleDigestEvaluation,
  exampleDailyDigestCron,
  buildDigestEmailHTML,
};
