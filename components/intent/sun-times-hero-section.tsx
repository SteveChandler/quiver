"use client";

import { Sunrise, Sunset, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CitySunTimesData } from "@/actions/forecast/intent-forecast-actions";
import { useEffect, useState } from "react";

type SunTimesMode = "dawn-patrol" | "sunset";

interface SunTimesHeroSectionProps {
  data: CitySunTimesData;
  mode: SunTimesMode;
}

/** Get theme colors based on mode */
function getTheme(mode: SunTimesMode) {
  if (mode === "dawn-patrol") {
    return {
      gradient: "from-white/80 to-indigo-50/60",
      border: "border-indigo-200/50",
      iconColor: "text-indigo-600",
      tempColor: "text-indigo-700",
      badgeBg: "bg-indigo-100/80 text-indigo-800",
      accentBorder: "border-indigo-100/50",
      accentBg: "from-white/90 to-indigo-50/30",
      Icon: Sunrise,
      primaryLabel: "Sunrise",
      secondaryLabel: "First Light",
      primaryTime: (d: CitySunTimesData) => d.sunrise,
      secondaryTime: (d: CitySunTimesData) => d.firstLight,
    };
  }
  return {
    gradient: "from-white/80 to-amber-50/60",
    border: "border-amber-200/50",
    iconColor: "text-amber-600",
    tempColor: "text-amber-700",
    badgeBg: "bg-amber-100/80 text-amber-800",
    accentBorder: "border-amber-100/50",
    accentBg: "from-white/90 to-amber-50/30",
    Icon: Sunset,
    primaryLabel: "Sunset",
    secondaryLabel: "Golden Hour",
    primaryTime: (d: CitySunTimesData) => d.sunset,
    secondaryTime: (d: CitySunTimesData) =>
      d.goldenHour ? `${d.goldenHour.start} \u2013 ${d.goldenHour.end}` : d.lastLight,
  };
}

/** Simple countdown component */
function Countdown({
  targetTimeStr,
  label,
}: {
  targetTimeStr: string;
  label: string;
}) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      // Parse today's time from the formatted string (e.g., "6:32 AM")
      const now = new Date();
      const [timePart, ampm] = targetTimeStr.split(/\s+/);
      if (!timePart || !ampm) return;
      const [hours, minutes] = timePart.split(":").map(Number);
      let hour24 = hours;
      if (ampm.toUpperCase() === "PM" && hours !== 12) hour24 += 12;
      if (ampm.toUpperCase() === "AM" && hours === 12) hour24 = 0;

      const target = new Date(now);
      target.setHours(hour24, minutes, 0, 0);

      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft("");
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m`);
    }

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [targetTimeStr]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Clock className="h-4 w-4" />
      <span>
        {label} in {timeLeft}
      </span>
    </div>
  );
}

export function SunTimesHeroSection({ data, mode }: SunTimesHeroSectionProps) {
  const theme = getTheme(mode);
  const { Icon } = theme;

  return (
    <section data-testid="sun-times-hero" className="space-y-6">
      <Card
        className={`overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br ${theme.gradient} ${theme.border} shadow-lg`}
      >
        <CardContent className="pt-6 space-y-6">
          {/* Primary time display */}
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="flex items-center">
              <Icon className={`h-8 w-8 ${theme.iconColor} mr-3`} />
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  {theme.primaryLabel}
                </p>
                <span
                  className={`text-5xl md:text-6xl font-bold ${theme.tempColor}`}
                >
                  {theme.primaryTime(data)}
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              {/* Secondary time info */}
              <div>
                <Badge
                  variant="secondary"
                  className={`text-sm font-medium ${theme.badgeBg}`}
                >
                  {theme.secondaryLabel}: {theme.secondaryTime(data)}
                </Badge>
              </div>

              {/* Day length info */}
              <div className="text-sm text-gray-600 space-y-1">
                <p>Day length: {data.dayLength}</p>
                {data.dayLengthChange && (
                  <p className="text-xs text-gray-500">{data.dayLengthChange}</p>
                )}
              </div>

              {/* Countdown */}
              {mode === "dawn-patrol" && (
                <Countdown targetTimeStr={data.sunrise} label="Sunrise" />
              )}
              {mode === "sunset" && (
                <Countdown targetTimeStr={data.sunset} label="Sunset" />
              )}
            </div>
          </div>

          {/* Sunrise + Sunset summary row */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">
                Sunrise
              </p>
              <p className="text-lg font-semibold text-gray-800">
                {data.sunrise}
              </p>
              <p className="text-xs text-gray-500">
                First light: {data.firstLight}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">
                Sunset
              </p>
              <p className="text-lg font-semibold text-gray-800">
                {data.sunset}
              </p>
              <p className="text-xs text-gray-500">
                Last light: {data.lastLight}
              </p>
            </div>
          </div>

          {/* Attribution */}
          <p className="text-xs text-gray-500">
            Data from {data.beachName} · Updated daily
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
