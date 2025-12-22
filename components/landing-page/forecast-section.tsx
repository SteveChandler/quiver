"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Thermometer, Waves, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionWrapper } from "./section-wrapper";
import { CONTENT } from "@/lib/constants/features";

// Generate dynamic forecast data for landing page
const generateForecastData = () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getDayName = (date: Date) => {
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  return [
    {
      day: "Today",
      date: formatDate(today),
      waveHeight: "3-4 ft",
      windSpeed: "4 mph",
      waterTemp: "65°F",
      conditions: "Good",
    },
    {
      day: "Tomorrow",
      date: formatDate(tomorrow),
      waveHeight: "5-6 ft",
      windSpeed: "18 mph",
      waterTemp: "64°F",
      conditions: "Excellent",
    },
    {
      day: getDayName(dayAfter),
      date: formatDate(dayAfter),
      waveHeight: "2-3 ft",
      windSpeed: "12 mph",
      waterTemp: "65°F",
      conditions: "Fair",
    },
  ];
};

const MODERN_FORECAST_DATA = generateForecastData();

function getConditionsPillClassName(conditions: string) {
  if (conditions === "Excellent") return "bg-green-100 text-green-800";
  if (conditions === "Good") return "bg-blue-100 text-blue-800";
  return "bg-yellow-100 text-yellow-800";
}

function PhoneForecastPreview({
  day,
  date,
  waveHeight,
  windSpeed,
  waterTemp,
  conditions,
  testId,
}: {
  day: string;
  date: string;
  waveHeight: string;
  windSpeed: string;
  waterTemp: string;
  conditions: string;
  testId?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm" data-testid={testId}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-900">{day}</p>
            <p className="text-[11px] text-gray-500">{date}</p>
          </div>
          <span
            className={`shrink-0 inline-flex px-2 py-1 rounded-full text-[10px] font-medium ${getConditionsPillClassName(
              conditions
            )}`}
            data-testid="forecast-conditions-badge"
          >
            {conditions}
          </span>
        </div>

        <div className="mt-3 rounded-xl bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves aria-hidden="true" className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[11px] font-medium text-gray-700">
                Waves
              </span>
            </div>
            <span className="text-[11px] font-semibold text-blue-700">
              {waveHeight}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind aria-hidden="true" className="h-3.5 w-3.5 text-gray-600" />
              <span className="text-[11px] font-medium text-gray-700">
                Wind
              </span>
            </div>
            <span className="text-[11px] text-gray-700">{windSpeed}</span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Thermometer
                aria-hidden="true"
                className="h-3.5 w-3.5 text-orange-600"
              />
              <span className="text-[11px] font-medium text-gray-700">
                Water
              </span>
            </div>
            <span className="text-[11px] text-gray-700">{waterTemp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForecastSection() {
  const [todayForecast, tomorrowForecast, dayAfterForecast] =
    MODERN_FORECAST_DATA;

  return (
    <SectionWrapper className="py-16 md:py-20 px-4 bg-white" maxWidth="6xl">
      <div
        className="relative overflow-hidden rounded-[32px] sm:rounded-[40px] lg:rounded-[48px] bg-[#F3EEE6] shadow-sm ring-1 ring-black/5 animate-fade-in-up"
        data-testid="forecast-section"
      >
        <div className="px-12 lg:px-20 py-16 lg:py-20">
          <div className="grid grid-cols-1 md:grid-cols-[180px_auto_1fr] gap-y-12 gap-x-16 lg:gap-x-24 items-center">
            {/* Left: mini-nav (AllTrails-style) */}
            <div className="w-[180px] shrink-0 flex flex-col items-center md:items-start md:self-stretch md:justify-center">
              <div className="flex items-center justify-center md:justify-start">
                <button
                  type="button"
                  aria-label="Previous highlight"
                  className="h-10 w-10 rounded-full bg-white/70 shadow-sm ring-1 ring-black/5 hover:bg-white transition-colors"
                >
                  <ArrowUp
                    aria-hidden="true"
                    className="mx-auto h-4 w-4 text-gray-700"
                  />
                </button>
              </div>

              <nav
                aria-label="Forecast highlights"
                className="mt-8 flex flex-col items-center md:items-start gap-6"
              >
                <button
                  type="button"
                  className="text-sm font-normal text-slate-700 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-500 transition-colors text-left"
                >
                  Waves & swell
                </button>
                <button
                  type="button"
                  className="text-sm font-normal text-slate-700 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-500 transition-colors text-left"
                >
                  Wind & weather
                </button>
                <button
                  type="button"
                  className="text-sm font-normal text-slate-700 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-500 transition-colors text-left"
                >
                  Water & temps
                </button>
              </nav>

              <div className="mt-8 flex items-center justify-center md:justify-start">
                <button
                  type="button"
                  aria-label="Next highlight"
                  className="h-10 w-10 rounded-full bg-white/70 shadow-sm ring-1 ring-black/5 hover:bg-white transition-colors"
                >
                  <ArrowDown
                    aria-hidden="true"
                    className="mx-auto h-4 w-4 text-gray-700"
                  />
                </button>
              </div>
            </div>

            {/* Center: phone mock */}
            <div className="flex justify-center shrink-0">
              <div className="relative w-[260px] sm:w-[300px] md:w-[340px] lg:w-[360px]">
                {/* Device frame */}
                <div className="relative aspect-[9/19.5] rounded-[56px] bg-slate-900 p-[10px] shadow-2xl ring-1 ring-black/20">
                  {/* subtle glass highlight */}
                  <div className="pointer-events-none absolute inset-0 rounded-[56px] bg-gradient-to-b from-white/10 via-transparent to-black/20" />

                  {/* Side buttons */}
                  <div className="pointer-events-none absolute -left-[3px] top-[22%] h-10 w-[3px] rounded-full bg-slate-700/80" />
                  <div className="pointer-events-none absolute -left-[3px] top-[30%] h-14 w-[3px] rounded-full bg-slate-700/80" />
                  <div className="pointer-events-none absolute -right-[3px] top-[28%] h-16 w-[3px] rounded-full bg-slate-700/80" />

                  {/* Notch */}
                  <div className="pointer-events-none absolute left-1/2 top-[10px] h-[26px] w-[122px] -translate-x-1/2 rounded-full bg-slate-950">
                    <div className="absolute right-4 top-1/2 h-[8px] w-[8px] -translate-y-1/2 rounded-full bg-slate-700" />
                  </div>

                  {/* Screen */}
                  <div className="relative h-full w-full overflow-hidden rounded-[46px] bg-white">
                    {/* Give top safe-area so content doesn't collide with notch */}
                    <div className="px-5 pt-10 pb-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">
                          Forecast
                        </p>
                        <p className="text-xs text-gray-500">Live</p>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Trusted by your local surf community
                      </p>
                    </div>

                    {/* IMPORTANT: constrain content so it doesn't force a square */}
                    <div className="px-5 pb-6 space-y-3" data-testid="forecast-cards-grid">
                      <PhoneForecastPreview {...todayForecast} testId="forecast-card-0" />
                      <div className="grid grid-cols-2 gap-3">
                        <PhoneForecastPreview {...tomorrowForecast} testId="forecast-card-1" />
                        <PhoneForecastPreview {...dayAfterForecast} testId="forecast-card-2" />
                      </div>
                    </div>

                    {/* bottom home indicator */}
                    <div className="pointer-events-none absolute bottom-3 left-1/2 h-1.5 w-28 -translate-x-1/2 rounded-full bg-slate-900" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: copy + CTAs */}
            <div className="text-center md:text-left">
              <h2 className="text-4xl lg:text-5xl font-roboto font-semibold tracking-tight leading-[1.05] text-slate-900">
                {CONTENT.sections.forecast.title}
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-600 max-w-[420px] mx-auto md:mx-0">
                {CONTENT.sections.forecast.subtitle}
              </p>

              <div className="mt-10 flex flex-col gap-4 items-center md:items-start">
                <Button
                  className="rounded-full px-7 py-3 text-sm font-semibold bg-ocean-blue hover:bg-ocean-blue/90 text-white shadow-sm"
                  asChild
                  data-testid="forecast-cta-map"
                >
                  <Link href="/map">
                    {CONTENT.sections.forecast.primaryCta}
                  </Link>
                </Button>

                <Link
                  href="/auth/sign-up"
                  className="text-sm font-semibold text-slate-700 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-500 transition-colors"
                  data-testid="forecast-cta-signup"
                >
                  {CONTENT.sections.forecast.secondaryCta}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
