import type { Beach } from '@/types/database';
import { formatMonthRange } from '@/lib/utils/date-time';
import { degreeToCardinal } from '@/lib/utils/geo-utils';

export interface FAQItem {
  question: string;
  answer: string;
}

export function generateBeachFAQ(beach: Beach): FAQItem[] {
  const name = beach.name;

  return [
    generateBeginnerFAQ(name, beach),
    generateTideFAQ(name, beach),
    generateBestTimeFAQ(name, beach),
    generateHazardsFAQ(name, beach),
    generateSwellFAQ(name, beach),
  ];
}

function generateBeginnerFAQ(name: string, beach: Beach): FAQItem {
  const question = `Is ${name} good for beginners?`;

  if (beach.skill_level) {
    const level = beach.skill_level.toLowerCase();
    const breakInfo = beach.break_type ? ` ${beach.break_type} break` : '';

    if (level === 'beginner') {
      const hazardNote =
        beach.hazards && beach.hazards.length > 0
          ? ` Be aware of ${beach.hazards.join(', ').toLowerCase()}.`
          : ' The conditions are generally forgiving for new surfers.';
      return {
        question,
        answer: `Yes! ${name} is a beginner-friendly${breakInfo}.${hazardNote}`,
      };
    }

    const hazardNote =
      beach.hazards && beach.hazards.length > 0
        ? ` Watch for ${beach.hazards.join(', ').toLowerCase()}.`
        : '';
    const recommendation = level === 'advanced' ? ' Not recommended for beginners.' : ' Less experienced surfers should use caution.';
    return {
      question,
      answer: `${name} is an ${level}-level${breakInfo}.${hazardNote}${recommendation}`,
    };
  }

  return {
    question,
    answer: `${name} conditions vary daily. Check the surf report for current conditions to determine if today is suitable for your skill level.`,
  };
}

function generateTideFAQ(name: string, beach: Beach): FAQItem {
  const question = `What tide is best for ${name}?`;

  const hasRange = beach.preferred_tide_ft_min != null && beach.preferred_tide_ft_max != null;
  const hasDirection = beach.preferred_tide_direction != null;

  if (hasRange && hasDirection) {
    return {
      question,
      answer: `${name} works best on a ${beach.preferred_tide_direction} tide between ${beach.preferred_tide_ft_min}-${beach.preferred_tide_ft_max}ft.`,
    };
  }

  if (hasRange) {
    return {
      question,
      answer: `${name} works best with tide levels between ${beach.preferred_tide_ft_min}-${beach.preferred_tide_ft_max}ft.`,
    };
  }

  if (hasDirection) {
    return {
      question,
      answer: `${name} tends to work best on a ${beach.preferred_tide_direction} tide.`,
    };
  }

  return {
    question,
    answer: `Optimal tide conditions at ${name} depend on the swell and sandbar setup. Check the daily report for current tide recommendations.`,
  };
}

function generateBestTimeFAQ(name: string, beach: Beach): FAQItem {
  const question = `When is the best time to surf ${name}?`;

  if (beach.best_months && beach.best_months.length > 0) {
    const range = formatMonthRange(beach.best_months);
    const prose = beach.best_conditions_prose ? ` ${beach.best_conditions_prose}` : '';
    return {
      question,
      answer: `${name} is prime from ${range}.${prose}`,
    };
  }

  return {
    question,
    answer: `The best time to surf ${name} depends on swell direction and seasonal patterns. Our daily report analyzes conditions to recommend the best window.`,
  };
}

function generateHazardsFAQ(name: string, beach: Beach): FAQItem {
  const question = `What are the hazards at ${name}?`;

  if (beach.hazards && beach.hazards.length > 0) {
    return {
      question,
      answer: `Hazards at ${name} include ${beach.hazards.join(', ').toLowerCase()}. Always check current conditions before paddling out.`,
    };
  }

  return {
    question,
    answer: `Check local conditions and talk to other surfers about current hazards before your session at ${name}.`,
  };
}

function generateSwellFAQ(name: string, beach: Beach): FAQItem {
  const question = `What swell direction works best at ${name}?`;

  const hasWindow = beach.swell_window_min_deg != null && beach.swell_window_max_deg != null;

  if (hasWindow) {
    const min = beach.swell_window_min_deg!;
    const max = beach.swell_window_max_deg!;
    let answer = `${name} picks up swells from ${degreeToCardinal(min)} to ${degreeToCardinal(max)} (${min}°-${max}°).`;

    if (beach.wind_offshore_deg != null) {
      const deg = beach.wind_offshore_deg;
      answer += ` Offshore winds blow from ${degreeToCardinal(deg)} (${deg}°).`;
    }

    return { question, answer };
  }

  return {
    question,
    answer: `Swell direction preferences at ${name} depend on the coastline orientation. Check the forecast for today's swell direction and how it lines up.`,
  };
}
