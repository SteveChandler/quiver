"use client";

import { Star, Users, Waves, Wind, TrendingUp } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";

export function PersonalizationShowcase() {
  return (
    <SectionWrapper
      className="py-16 md:py-20 px-4 bg-white"
      data-testid="personalization-showcase"
    >
      {/* Section header */}
      <div className="text-center mb-12 animate-fade-in-up">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-roboto font-bold text-dark-grey mb-4">
          Forecasts that know you
        </h2>
        <p className="text-lg font-open-sans text-gray-600 max-w-2xl mx-auto">
          See the difference personalization makes
        </p>
      </div>

      {/* Two-card comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Generic card */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
            Generic forecast
          </p>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-roboto font-bold text-gray-400">
              72
            </span>
            <span className="text-lg text-gray-400">/100</span>
          </div>

          <p className="text-sm font-open-sans text-gray-400 mb-6">
            Good conditions
          </p>

          <ul className="space-y-3">
            <li className="flex items-center gap-2 text-sm text-gray-400">
              <Waves className="h-4 w-4 shrink-0" />
              <span>3-4 ft waves</span>
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-400">
              <Wind className="h-4 w-4 shrink-0" />
              <span>Light onshore wind</span>
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-400">
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span>Rising tide</span>
            </li>
          </ul>
        </div>

        {/* Personalized card */}
        <div className="relative rounded-2xl border border-ocean-blue/20 bg-gradient-to-br from-ocean-blue/5 via-white to-ocean-blue/10 p-6 sm:p-8 shadow-md ring-1 ring-ocean-blue/10">
          <p className="text-xs font-semibold uppercase tracking-wider text-ocean-blue mb-4">
            Personalized for you
          </p>

          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl font-roboto font-bold text-ocean-blue">
              91%
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-ocean-blue/10 px-2.5 py-0.5 text-xs font-semibold text-ocean-blue">
              <Star className="h-3 w-3 fill-current" />
              Match
            </span>
          </div>

          <p className="text-sm font-open-sans text-gray-700 mb-6">
            Your ideal wave range, offshore wind, rising tide
          </p>

          <ul className="space-y-3">
            <li className="flex items-center gap-2 text-sm text-gray-700">
              <Waves className="h-4 w-4 shrink-0 text-ocean-blue" />
              <span>3-4 ft — your sweet spot</span>
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700">
              <Wind className="h-4 w-4 shrink-0 text-ocean-blue" />
              <span>Offshore 8 mph — clean faces</span>
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700">
              <TrendingUp className="h-4 w-4 shrink-0 text-ocean-blue" />
              <span>Rising tide — your preferred window</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Community intel callout */}
      <div className="mt-8 flex flex-col items-center text-center animate-fade-in-up">
        <div className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <Users className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium font-open-sans text-green-700">
            Plus, real-time intel from surfers in the water right now
          </span>
        </div>
      </div>
    </SectionWrapper>
  );
}
