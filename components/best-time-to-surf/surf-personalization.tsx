"use client";

/**
 * Surf Personalization — "Best Month for ME"
 *
 * Skill level + crowd preference filters monthly data and
 * outputs a recommendation: "Based on your preferences, visit X in Y."
 */

import { useState, useMemo } from "react";
import type { StateSurfProfile, MonthlyData } from "@/lib/data/monthly-surf-data";

type SkillLevel = "beginner" | "intermediate" | "advanced";
type CrowdPreference = "avoid" | "any";

interface Recommendation {
  stateName: string;
  stateSlug: string;
  month: string;
  score: number;
  waveHeightRange: string;
  waterTemp: number;
  wetsuit: string;
  crowdLevel: string;
  bestFor: string;
}

/** Wave height ranges suitable per skill level (max face height ft) */
const SKILL_WAVE_MAX: Record<SkillLevel, number> = {
  beginner: 3,
  intermediate: 6,
  advanced: 99,
};

/** Min water temp comfort thresholds (beginners prefer warmer water) */
const SKILL_WATER_TEMP_MIN: Record<SkillLevel, number> = {
  beginner: 65,
  intermediate: 52,
  advanced: 0,
};

function parseMaxWaveHeight(range: string): number {
  // "3-6 ft" -> 6, "4-10 ft" -> 10
  const match = range.match(/(\d+)\s*ft/g);
  if (!match || match.length < 2) {
    const single = range.match(/(\d+)/);
    return single ? parseInt(single[1]) : 99;
  }
  return parseInt(match[match.length - 1]);
}

function scoreMonthForPreferences(
  entry: MonthlyData,
  skill: SkillLevel,
  crowd: CrowdPreference
): number {
  let score = entry.overallScore;

  // Penalize waves too big for skill level
  const maxWave = parseMaxWaveHeight(entry.waveHeightRange);
  if (maxWave > SKILL_WAVE_MAX[skill]) {
    // Reduce score proportionally — beginners should avoid overhead surf
    score -= (maxWave - SKILL_WAVE_MAX[skill]) * 8;
  }

  // Penalize cold water for beginners/intermediates
  if (entry.waterTemp < SKILL_WATER_TEMP_MIN[skill]) {
    score -= (SKILL_WATER_TEMP_MIN[skill] - entry.waterTemp) * 1.5;
  }

  // Crowd preference
  if (crowd === "avoid" && entry.crowdLevel === "high") {
    score -= 25;
  }

  return Math.max(0, score);
}

interface SurfPersonalizationProps {
  stateProfiles: StateSurfProfile[];
}

export function SurfPersonalization({ stateProfiles }: SurfPersonalizationProps) {
  const [skill, setSkill] = useState<SkillLevel>("intermediate");
  const [crowd, setCrowd] = useState<CrowdPreference>("any");
  const [hasInteracted, setHasInteracted] = useState(false);

  const recommendations = useMemo<Recommendation[]>(() => {
    if (!hasInteracted) return [];

    const results: Array<{ state: StateSurfProfile; month: MonthlyData; score: number }> = [];

    for (const state of stateProfiles) {
      for (const entry of state.monthly) {
        const score = scoreMonthForPreferences(entry, skill, crowd);
        results.push({ state, month: entry, score });
      }
    }

    // Top 3 unique state-month combos
    const seen = new Set<string>();
    return results
      .sort((a, b) => b.score - a.score)
      .filter(({ state, month }) => {
        const key = `${state.stateSlug}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3)
      .map(({ state, month, score }) => ({
        stateName: state.stateName,
        stateSlug: state.stateSlug,
        month: month.month,
        score,
        waveHeightRange: month.waveHeightRange,
        waterTemp: month.waterTemp,
        wetsuit: month.wetsuit,
        crowdLevel: month.crowdLevel,
        bestFor: month.bestFor,
      }));
  }, [hasInteracted, skill, crowd, stateProfiles]);

  const skillLabels: Record<SkillLevel, { label: string; desc: string }> = {
    beginner: { label: "Beginner", desc: "Still learning to pop up" },
    intermediate: { label: "Intermediate", desc: "Catching green waves, starting to turn" },
    advanced: { label: "Advanced", desc: "Comfortable in overhead surf" },
  };

  function handleSkillChange(s: SkillLevel) {
    setSkill(s);
    setHasInteracted(true);
  }

  function handleCrowdChange(c: CrowdPreference) {
    setCrowd(c);
    setHasInteracted(true);
  }

  return (
    <div className="rounded-2xl bg-[#1A2158] border border-[#F78E42]/20 p-6">
      <h2 className="text-lg font-bold text-white mb-1">Best Month for Me</h2>
      <p className="text-slate-400 text-sm mb-5">
        Tell us your skill level and we&apos;ll match you with the best state + month combo.
      </p>

      {/* Skill selector */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Skill Level
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(skillLabels) as SkillLevel[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSkillChange(s)}
              className={`
                rounded-xl border p-3 text-left transition-colors
                ${skill === s
                  ? "border-[#F78E42] bg-[#F78E42]/10 text-white"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/10"
                }
              ` + " focus-ring"}
            >
              <p className="font-semibold text-sm">{skillLabels[s].label}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-tight">
                {skillLabels[s].desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Crowd preference */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Crowd Preference
        </p>
        <div className="flex gap-2">
          {(["any", "avoid"] as CrowdPreference[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleCrowdChange(c)}
              className={`
                flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors
                ${crowd === c
                  ? "border-[#F78E42] bg-[#F78E42]/10 text-white"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30"
                }
              ` + " focus-ring"}
            >
              {c === "any" ? "Don't care" : "Avoid crowds"}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {!hasInteracted ? (
        <div className="text-center py-4 text-slate-500 text-sm">
          Select your preferences above to get recommendations
        </div>
      ) : recommendations.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
            Top picks for you
          </p>
          {recommendations.map((rec, i) => (
            <div
              key={rec.stateSlug}
              className={`rounded-xl border p-4 ${
                i === 0
                  ? "border-[#F78E42]/50 bg-[#F78E42]/5"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  {i === 0 && (
                    <span className="text-[10px] font-bold text-[#F78E42] uppercase tracking-widest block mb-0.5">
                      Best match
                    </span>
                  )}
                  <h3 className="font-bold text-white">
                    {rec.stateName} in {rec.month}
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400 shrink-0">
                  Score: {Math.round(rec.score)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300 mb-2">
                <span>Waves: <strong className="text-white">{rec.waveHeightRange}</strong></span>
                <span>Temp: <strong className="text-white">{rec.waterTemp}°F</strong></span>
                <span>Wetsuit: <strong className="text-white">{rec.wetsuit}</strong></span>
                <span>Crowds: <strong className="text-white capitalize">{rec.crowdLevel}</strong></span>
              </div>
              {rec.bestFor && (
                <p className="text-xs text-slate-400 italic">{rec.bestFor}</p>
              )}
              <a
                href={`/best-time-to-surf#${rec.stateSlug}`}
                className="mt-3 inline-flex text-xs text-[#F78E42] hover:underline"
              >
                View full {rec.stateName} calendar →
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-slate-400 text-sm">
          No matching destinations found. Try adjusting your preferences.
        </div>
      )}
    </div>
  );
}
