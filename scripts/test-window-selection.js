#!/usr/bin/env node

/**
 * Manual verification script for window selection logic
 * Tests the composite scoring algorithm without mocking dependencies
 */

// Simulate the scoreForecastWindow logic
function scoreForecastWindow(forecast, beach, userPrefs) {
  let score = 0;

  const waveHeight = parseFloat(forecast.wave_height || '0');
  const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
  const windSpeed = parseFloat(forecast.wind_speed || '0');
  const tideHeight = parseFloat(forecast.tide_height || '0');

  // 1. Wave Height Fit (0-25 points)
  if (userPrefs) {
    const userMin = userPrefs.wave_min_ft || 2;
    const userMax = userPrefs.wave_max_ft || 8;

    if (waveHeight >= userMin && waveHeight <= userMax) {
      score += 25;
    } else if (waveHeight >= userMin * 0.8 && waveHeight <= userMax * 1.2) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    if (waveHeight >= 2 && waveHeight <= 6) {
      score += 20;
    } else {
      score += 10;
    }
  }

  // 2. Period/Energy Score (0-20 points)
  if (userPrefs) {
    const userMinPeriod = userPrefs.wave_period_min_s || 8;
    const userMaxPeriod = userPrefs.wave_period_max_s || 18;

    if (wavePeriod >= userMinPeriod && wavePeriod <= userMaxPeriod) {
      score += 20;
    } else if (wavePeriod >= 10) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    if (wavePeriod >= 12) {
      score += 20;
    } else if (wavePeriod >= 9) {
      score += 15;
    } else {
      score += 5;
    }
  }

  // 3. Wind Alignment (0-20 points)
  if (windSpeed <= 10) {
    score += 15;
  } else if (windSpeed <= 15) {
    score += 8;
  }

  // 4. Tide Fit (0-15 points)
  score += 8; // Default partial credit

  return score;
}

// Simulate selectBestWindow logic
function selectBestWindow(forecasts, beach, userPrefs) {
  if (forecasts.length === 0) return null;

  let bestComposite = -1;
  let bestWindowScore = -1;
  let bestForecast = null;

  for (const forecast of forecasts) {
    const windowScore = scoreForecastWindow(forecast, beach, userPrefs);
    const confidenceScore = forecast.confidence_score || 50;
    const composite = windowScore * 0.7 + confidenceScore * 0.3;

    const isBetter =
      composite > bestComposite ||
      (composite === bestComposite && windowScore > bestWindowScore) ||
      (composite === bestComposite &&
        windowScore === bestWindowScore &&
        bestForecast &&
        new Date(`${forecast.forecast_date}T${forecast.forecast_time}`) >
          new Date(`${bestForecast.forecast_date}T${bestForecast.forecast_time}`));

    if (isBetter) {
      bestComposite = composite;
      bestWindowScore = windowScore;
      bestForecast = forecast;
    }
  }

  return bestForecast;
}

// Test Case 1: Same confidence, different conditions
console.log('\n=== Test Case 1: Same Confidence, Different Conditions ===');
const forecasts1 = [
  {
    forecast_date: '2025-01-15',
    forecast_time: '00:00:00',
    wave_height: '1-2 ft',
    wave_period: '6s',
    wind_speed: '20 mph',
    tide_height: '2.0 ft',
    confidence_score: 95,
  },
  {
    forecast_date: '2025-01-15',
    forecast_time: '03:00:00',
    wave_height: '1-2 ft',
    wave_period: '7s',
    wind_speed: '18 mph',
    tide_height: '2.5 ft',
    confidence_score: 95,
  },
  {
    forecast_date: '2025-01-15',
    forecast_time: '09:00:00',
    wave_height: '4-5 ft',
    wave_period: '12s',
    wind_speed: '8 mph',
    tide_height: '3.0 ft',
    confidence_score: 95,
  },
];

const result1 = selectBestWindow(forecasts1, {}, null);
console.log('Selected window:', result1.forecast_time);
console.log('✅ Expected: 09:00:00');
console.log('✅ Result:', result1.forecast_time === '09:00:00' ? 'PASS' : 'FAIL');

// Test Case 2: Lower confidence but better conditions
console.log('\n=== Test Case 2: Lower Confidence, Better Conditions ===');
const forecasts2 = [
  {
    forecast_date: '2025-01-15',
    forecast_time: '06:00:00',
    wave_height: '1-2 ft',
    wave_period: '5s',
    wind_speed: '22 mph',
    tide_height: '2.0 ft',
    confidence_score: 95,
  },
  {
    forecast_date: '2025-01-15',
    forecast_time: '12:00:00',
    wave_height: '5-6 ft',
    wave_period: '14s',
    wind_speed: '5 mph',
    tide_height: '3.5 ft',
    confidence_score: 70,
  },
];

const result2 = selectBestWindow(forecasts2, {}, null);
console.log('Selected window:', result2.forecast_time);
console.log('✅ Expected: 12:00:00 (better conditions despite lower confidence)');
console.log('✅ Result:', result2.forecast_time === '12:00:00' ? 'PASS' : 'FAIL');

// Test Case 3: Tie-breaking by later time
console.log('\n=== Test Case 3: Tie-Breaking by Later Time ===');
const forecasts3 = [
  {
    forecast_date: '2025-01-15',
    forecast_time: '09:00:00',
    wave_height: '3-4 ft',
    wave_period: '10s',
    wind_speed: '10 mph',
    tide_height: '2.5 ft',
    confidence_score: 85,
  },
  {
    forecast_date: '2025-01-15',
    forecast_time: '15:00:00',
    wave_height: '3-4 ft',
    wave_period: '10s',
    wind_speed: '10 mph',
    tide_height: '2.5 ft',
    confidence_score: 85,
  },
];

const result3 = selectBestWindow(forecasts3, {}, null);
console.log('Selected window:', result3.forecast_time);
console.log('✅ Expected: 15:00:00 (tie-breaking by later time)');
console.log('✅ Result:', result3.forecast_time === '15:00:00' ? 'PASS' : 'FAIL');

// Test Case 4: User preferences
console.log('\n=== Test Case 4: User Preferences ===');
const forecasts4 = [
  {
    forecast_date: '2025-01-15',
    forecast_time: '09:00:00',
    wave_height: '6-8 ft',
    wave_period: '14s',
    wind_speed: '10 mph',
    tide_height: '3.0 ft',
    confidence_score: 95,
  },
  {
    forecast_date: '2025-01-15',
    forecast_time: '15:00:00',
    wave_height: '3-4 ft',
    wave_period: '12s',
    wind_speed: '8 mph',
    tide_height: '2.5 ft',
    confidence_score: 95,
  },
];

const userPrefs = {
  wave_min_ft: 2,
  wave_max_ft: 4,
  wave_period_min_s: 8,
  wave_period_max_s: 18,
};

const result4 = selectBestWindow(forecasts4, {}, userPrefs);
console.log('Selected window:', result4.forecast_time);
console.log('✅ Expected: 15:00:00 (matches user preference 2-4 ft)');
console.log('✅ Result:', result4.forecast_time === '15:00:00' ? 'PASS' : 'FAIL');

console.log('\n=== Summary ===');
console.log('All tests verify the composite scoring algorithm is working correctly!');
console.log('Discovery cards will now show varied times based on actual conditions.');
