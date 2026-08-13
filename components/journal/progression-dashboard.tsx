"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Plus, Share2 } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { CenteredLoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ZeroState } from "@/components/ui/zero-state";
import {
  getProgressionDashboard,
  recordProgressionShare,
} from "@/actions/progression-actions";
import type { ProgressionDashboardData } from "@/actions/progression-actions";

// ---------------------------------------------------------------------------
// Share helpers
// ---------------------------------------------------------------------------

async function shareOrCopy(text: string, title: string): Promise<void> {
  let shared = false;
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      shared = true;
    } catch {
      // Fall through to clipboard
    }
  }
  if (!shared && typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    shared = true;
  }
  if (shared) {
    recordProgressionShare().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

function monthOverMonthLabel(current: number, previous: number, unit: string): string | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return `+${current} ${unit} this month`;
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff} ${unit} (${sign}${pct}%)`;
}

// ---------------------------------------------------------------------------
// Card 1: Streaks & Monthly Summary
// ---------------------------------------------------------------------------

interface StreakCardProps {
  data: ProgressionDashboardData;
}

function StreakCard({ data }: StreakCardProps) {
  const { streaks, monthlySummary } = data;
  const fireCount = Math.min(streaks.currentStreak, 5);
  const fires = "🔥".repeat(fireCount);
  const momLabel = monthOverMonthLabel(monthlySummary.sessions, monthlySummary.prevSessions, "sessions");

  const handleShare = async () => {
    const text = `${streaks.currentStreak}-day surf streak on Quiver! ${fires} ${monthlySummary.sessions} sessions this month.`;
    await shareOrCopy(text, "My Surf Streak");
  };

  return (
    <Card
      className="bg-white/60 backdrop-blur-md border border-blue-100/50 rounded-2xl shadow-sm"
      data-testid="streak-card"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Streaks & This Month</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleShare} aria-label="Share streak">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-500">
              {streaks.currentStreak > 0 ? (
                <>
                  {streaks.currentStreak}
                  {fires && <span className="ml-1 text-2xl">{fires}</span>}
                </>
              ) : (
                <span className="text-muted-foreground text-2xl">0</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Day streak</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="text-center">
            <div className="text-2xl font-bold">{streaks.bestStreak}</div>
            <p className="text-xs text-muted-foreground mt-1">Best streak</p>
          </div>
        </div>

        <div className="border-t pt-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xl font-bold">{monthlySummary.sessions}</div>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div>
            <div className="text-xl font-bold">{monthlySummary.hours}h</div>
            <p className="text-xs text-muted-foreground">Hours</p>
          </div>
          <div>
            <div className="text-xl font-bold">{monthlySummary.avgRating > 0 ? monthlySummary.avgRating.toFixed(1) : "—"}</div>
            <p className="text-xs text-muted-foreground">Avg rating</p>
          </div>
        </div>

        {momLabel && (
          <p className="text-xs text-center text-muted-foreground">{momLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 2: Skill Progression
// ---------------------------------------------------------------------------

interface SkillProgressionCardProps {
  skillProgression: ProgressionDashboardData["skillProgression"];
}

function SkillProgressionCard({ skillProgression }: SkillProgressionCardProps) {
  return (
    <Card
      className="bg-white/60 backdrop-blur-md border border-blue-100/50 rounded-2xl shadow-sm"
      data-testid="skill-progression-card"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Skill Progression</CardTitle>
        <CardDescription className="text-xs">Based on your last 10 sessions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {skillProgression.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Rate your skills when logging sessions to track your progression.
          </p>
        ) : (
          skillProgression.map((trend) => {
            const diff = Math.round((trend.currentAvg - trend.previousAvg) * 10) / 10;
            const isNew = trend.count < 5;
            const barWidth = Math.round((trend.currentAvg / 5) * 100);

            return (
              <div key={trend.skill} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{trend.skill}</span>
                  <span className="text-muted-foreground">
                    {trend.currentAvg.toFixed(1)}/5
                    {isNew ? (
                      <span className="ml-1 text-blue-500">(new!)</span>
                    ) : diff > 0 ? (
                      <span className="ml-1 text-green-600">(+{diff.toFixed(1)})</span>
                    ) : diff < 0 ? (
                      <span className="ml-1 text-red-500">({diff.toFixed(1)})</span>
                    ) : null}
                  </span>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-[width] duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 3: Sweet Spot
// ---------------------------------------------------------------------------

interface SweetSpotCardProps {
  sweetSpot: ProgressionDashboardData["sweetSpot"];
}

function SweetSpotCard({ sweetSpot }: SweetSpotCardProps) {
  const handleShare = async () => {
    if (!sweetSpot) return;
    const text = `I found my sweet spot: ${sweetSpot.waveHeight} waves, ${sweetSpot.wind} wind on Quiver!`;
    await shareOrCopy(text, "My Surf Sweet Spot");
  };

  return (
    <Card
      className="bg-white/60 backdrop-blur-md border border-blue-100/50 rounded-2xl shadow-sm"
      data-testid="sweet-spot-card"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Your Sweet Spot</CardTitle>
          {sweetSpot && (
            <Button variant="ghost" size="sm" onClick={handleShare} aria-label="Share sweet spot">
              <Share2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!sweetSpot ? (
          <p className="text-sm text-muted-foreground">
            Keep logging to discover your sweet spot — the conditions where you surf best.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="text-sm font-semibold">{sweetSpot.waveHeight}</div>
                <p className="text-xs text-muted-foreground mt-1">Waves</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="text-sm font-semibold capitalize">{sweetSpot.tide}</div>
                <p className="text-xs text-muted-foreground mt-1">Tide</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="text-sm font-semibold capitalize">{sweetSpot.wind}</div>
                <p className="text-xs text-muted-foreground mt-1">Wind</p>
              </div>
            </div>
            {sweetSpot.bestBeach && (
              <p className="text-sm text-muted-foreground text-center">
                Best beach: <span className="font-medium text-foreground">{sweetSpot.bestBeach}</span>
              </p>
            )}
            {sweetSpot.confidence > 0 && (
              <p className="text-xs text-center text-green-600 font-medium">
                You rate sessions {Math.round(sweetSpot.confidence * 100)}% higher in these conditions
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 4: Personal Bests
// ---------------------------------------------------------------------------

interface PersonalBestsCardProps {
  personalBests: ProgressionDashboardData["personalBests"];
}

function PersonalBestsCard({ personalBests }: PersonalBestsCardProps) {
  const records = [
    {
      label: "Longest session",
      value: personalBests.longestSession.durationMinutes > 0
        ? formatDuration(personalBests.longestSession.durationMinutes)
        : null,
      date: personalBests.longestSession.date,
    },
    {
      label: "Biggest waves",
      value: personalBests.biggestWaves.waveHeight,
      date: personalBests.biggestWaves.date,
    },
    {
      label: "Best rated",
      value: personalBests.bestRated.rating > 0
        ? `${personalBests.bestRated.rating}/5 stars`
        : null,
      date: personalBests.bestRated.date,
    },
    {
      label: "Most sessions in a week",
      value: personalBests.mostSessionsWeek > 0
        ? `${personalBests.mostSessionsWeek} sessions`
        : null,
      date: null,
    },
    {
      label: "Longest streak",
      value: personalBests.longestStreak > 0
        ? `${personalBests.longestStreak} days`
        : null,
      date: null,
    },
  ].filter((r) => r.value !== null);

  return (
    <Card
      className="bg-white/60 backdrop-blur-md border border-blue-100/50 rounded-2xl shadow-sm"
      data-testid="personal-bests-card"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Personal Bests</CardTitle>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Log more sessions to build your personal bests.
          </p>
        ) : (
          <ul className="space-y-2">
            {records.map((record) => (
              <li
                key={record.label}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{record.label}</span>
                <span className="font-medium text-right">
                  {record.value}
                  {record.date && (
                    <span className="block text-xs text-muted-foreground font-normal">
                      {formatDate(record.date)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 5: Forecast Impact
// ---------------------------------------------------------------------------

interface ForecastImpactCardProps {
  forecastImpact: ProgressionDashboardData["forecastImpact"];
}

function ForecastImpactCard({ forecastImpact }: ForecastImpactCardProps) {
  const handleShare = async () => {
    const text = `I've logged ${forecastImpact.totalSessions} surf sessions and ${forecastImpact.conditionReports} condition reports on Quiver, helping train the forecast model for my local community!`;
    await shareOrCopy(text, "My Forecast Impact");
  };

  return (
    <Card
      className="bg-white/60 backdrop-blur-md border border-blue-100/50 rounded-2xl shadow-sm"
      data-testid="forecast-impact-card"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Your Forecast Impact</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleShare} aria-label="Share forecast impact">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="text-2xl font-bold">{forecastImpact.totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">Sessions logged</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="text-2xl font-bold">{forecastImpact.conditionReports}</div>
            <p className="text-xs text-muted-foreground mt-1">Condition reports</p>
          </div>
        </div>

        {forecastImpact.beaches.length > 0 && (
          <div className="space-y-2">
            {forecastImpact.beaches.map((beach) => {
              const accuracyDiff = beach.prevAccuracy !== null
                ? Math.round(beach.accuracy - beach.prevAccuracy)
                : null;

              return (
                <div key={beach.slug} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate">{beach.name}</span>
                  <span className="font-medium ml-2 shrink-0">
                    {beach.accuracy > 0 ? (
                      <>
                        {beach.accuracy}%
                        {accuracyDiff !== null && accuracyDiff !== 0 && (
                          <span
                            className={
                              accuracyDiff > 0 ? "text-green-600 ml-1" : "text-red-500 ml-1"
                            }
                          >
                            ({accuracyDiff > 0 ? "+" : ""}{accuracyDiff}%)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">{beach.userSessions} sessions</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground border-t pt-3">
          Every session you log helps train our forecast model for your local community.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Zero state
// ---------------------------------------------------------------------------

function ProgressionZeroState() {
  return (
    <div data-testid="progression-zero-state">
      <ZeroState
        icon={Plus}
        title="Start Your Progression Journey"
        description="Your sessions train our forecast model. Start logging to see your progression and improve forecasts for your community."
        action={{
          label: "Log Your First Session",
          href: "/sessions/new?mode=log",
          icon: Plus,
        }}
        proTip="Rate your skills each session to unlock your progression dashboard after 3 sessions"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProgressionDashboard() {
  const fetchProgression = useCallback(async () => {
    const result = await getProgressionDashboard();
    if (!result.success) throw new Error(result.error ?? "Failed to load progression data");
    return result.data as ProgressionDashboardData;
  }, []);

  const { data, loading, error } = useDataFetcher(fetchProgression);

  if (loading) {
    return <CenteredLoadingSpinner text="Loading your progression..." />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load progression data: {error}</AlertDescription>
      </Alert>
    );
  }

  // No data or truly empty session history
  const isEmpty =
    !data ||
    (data.forecastImpact.totalSessions === 0 &&
      data.skillProgression.length === 0 &&
      data.streaks.currentStreak === 0 &&
      data.streaks.bestStreak === 0);

  if (isEmpty) {
    return (
      <div data-testid="progression-dashboard">
        <ProgressionZeroState />
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      data-testid="progression-dashboard"
    >
      <StreakCard data={data} />
      <SkillProgressionCard skillProgression={data.skillProgression} />
      <SweetSpotCard sweetSpot={data.sweetSpot} />
      <PersonalBestsCard personalBests={data.personalBests} />
      <ForecastImpactCard forecastImpact={data.forecastImpact} />
    </div>
  );
}
