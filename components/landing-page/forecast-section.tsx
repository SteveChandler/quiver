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
}: {
  day: string;
  date: string;
  waveHeight: string;
  windSpeed: string;
  waterTemp: string;
  conditions: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
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
        className="relative overflow-hidden rounded-[32px] sm:rounded-[40px] lg:rounded-[48px] bg-[#f2eee8] shadow-sm ring-1 ring-black/5 animate-fade-in-up"
        data-testid="forecast-section-panel"
      >
        <div className="p-10 sm:p-12 lg:p-20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-12 md:gap-14 lg:gap-20">
            {/* Left: mini-nav (AllTrails-style) */}
            <div className="md:w-[200px] md:shrink-0 flex flex-col items-center md:items-start md:self-stretch md:justify-center">
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
                  className="text-sm font-medium text-gray-900 underline underline-offset-4 decoration-black/20 hover:decoration-black/40 transition-colors text-left"
                >
                  Waves & swell
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-gray-900 underline underline-offset-4 decoration-black/20 hover:decoration-black/40 transition-colors text-left"
                >
                  Wind & weather
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-gray-900 underline underline-offset-4 decoration-black/20 hover:decoration-black/40 transition-colors text-left"
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
            <div className="flex justify-center md:justify-center md:shrink-0">
              <div className="relative w-[300px] sm:w-[340px] md:w-[380px] lg:w-[420px]">
                <div className="relative rounded-[54px] bg-gray-900 p-[10px] shadow-2xl">
                  {/* Notch */}
                  <div className="pointer-events-none absolute left-1/2 top-[14px] h-[22px] w-[120px] -translate-x-1/2 rounded-full bg-gray-900" />

                  {/* Screen */}
                  <div className="rounded-[44px] bg-white overflow-hidden">
                    <div className="px-5 pt-7 pb-3">
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

                    <div className="px-5 pb-5 space-y-3">
                      <PhoneForecastPreview {...todayForecast} />
                      <div className="grid grid-cols-2 gap-3">
                        <PhoneForecastPreview {...tomorrowForecast} />
                        <PhoneForecastPreview {...dayAfterForecast} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: copy + CTAs */}
            <div className="text-center md:text-left md:flex-1 md:max-w-[520px]">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-roboto font-bold text-dark-grey leading-tight">
                {CONTENT.sections.forecast.title}
              </h2>
              <p className="mt-5 text-sm sm:text-base font-open-sans text-gray-700 leading-relaxed max-w-xl mx-auto md:mx-0">
                {CONTENT.sections.forecast.subtitle}
              </p>

              <div className="mt-10 flex flex-col gap-3 items-center md:items-start">
                <Button
                  size="lg"
                  className="bg-ocean-blue hover:bg-ocean-blue/90 text-white px-7 py-3.5 text-base font-roboto font-semibold rounded-full shadow-sm"
                  asChild
                >
                  <Link href="/map">
                    {CONTENT.sections.forecast.primaryCta}
                  </Link>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="px-7 py-3.5 text-base font-roboto font-semibold rounded-full bg-white/70 hover:bg-white border-gray-300"
                  asChild
                >
                  <Link href="/auth/sign-up">
                    {CONTENT.sections.forecast.secondaryCta}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
