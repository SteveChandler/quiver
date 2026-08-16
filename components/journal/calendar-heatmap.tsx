"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Waves, Calendar } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { CenteredLoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as dateFns from "date-fns";
import type { SessionWithDetails, CalendarHeatmapData } from "@/types/database";

interface CalendarHeatmapProps {
  userId: string;
  sessions: SessionWithDetails[];
  onDateClick?: (date: string, sessions: SessionWithDetails[]) => void;
}

export function CalendarHeatmap({
  userId,
  sessions,
  onDateClick,
}: CalendarHeatmapProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Group sessions by date
  const sessionsByDate = sessions.reduce((acc, session) => {
    const date = dateFns.format(new Date(session.arrival_time), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(session);
    return acc;
  }, {} as Record<string, SessionWithDetails[]>);

  // Get calendar month data
  const fetchCalendarData = useCallback(async () => {
    if (!userId) return [];

    try {
      const response = await fetch(
        `/api/analytics/sessions?userId=me&type=calendar&year=${currentDate.getFullYear()}&month=${
          currentDate.getMonth() + 1
        }`,
        {
          credentials: "include", // Ensure cookies are included
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Calendar API error:", response.status, errorData);
        throw new Error(
          `Failed to fetch calendar data: ${response.status} ${errorData}`
        );
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.warn("Failed to fetch calendar data:", error);
      return [];
    }
  }, [userId, currentDate]);

  const {
    data: calendarData,
    loading,
    error,
    refetch,
  } = useDataFetcher(fetchCalendarData);

  // Calculate calendar layout
  const monthStart = dateFns.startOfMonth(currentDate);
  const monthEnd = dateFns.endOfMonth(currentDate);
  const calendarStart = dateFns.startOfWeek(monthStart);
  const calendarEnd = dateFns.endOfWeek(monthEnd);
  const allDays = dateFns.eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get intensity for wave height coloring
  const getWaveHeightIntensity = (waveHeight: number): string => {
    if (waveHeight === 0) return "bg-muted";
    if (waveHeight < 2) return "bg-blue-100 dark:bg-blue-900";
    if (waveHeight < 4) return "bg-blue-200 dark:bg-blue-800";
    if (waveHeight < 6) return "bg-blue-300 dark:bg-blue-700";
    if (waveHeight < 8) return "bg-blue-400 dark:bg-blue-600";
    return "bg-blue-500 dark:bg-blue-500";
  };

  // Get session info for a specific date
  const getDateInfo = (date: Date) => {
    const dateStr = dateFns.format(date, "yyyy-MM-dd");
    const daySessions = sessionsByDate[dateStr] || [];

    const averageWaveHeight =
      daySessions.length > 0
        ? daySessions.reduce(
            (sum, session) => sum + (session.wave_quality || 0),
            0
          ) / daySessions.length
        : 0;

    const averageRating =
      daySessions.length > 0
        ? daySessions.reduce((sum, session) => sum + (session.rating || 0), 0) /
          daySessions.length
        : 0;

    return {
      date: dateStr,
      sessions: daySessions,
      sessionCount: daySessions.length,
      averageWaveHeight: Math.round(averageWaveHeight * 10) / 10,
      averageRating: Math.round(averageRating * 10) / 10,
    };
  };

  const handleDateClick = (date: Date) => {
    const dateInfo = getDateInfo(date);
    if (dateInfo.sessions.length > 0 && onDateClick) {
      onDateClick(dateInfo.date, dateInfo.sessions);
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate =
        direction === "prev" ? dateFns.subMonths(prev, 1) : dateFns.addMonths(prev, 1);
      return newDate;
    });
  };

  // Force refetch when month changes
  useEffect(() => {
    if (refetch) {
      refetch();
    }
  }, [currentDate, refetch]);

  if (loading) {
    return <CenteredLoadingSpinner text="Loading calendar..." />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load calendar data: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle className="text-lg">
                {dateFns.format(currentDate, "MMMM yyyy")}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("prev")}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("next")}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div
            className="grid grid-cols-7 gap-1"
            role="grid"
            aria-label="Calendar"
          >
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground"
                role="columnheader"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {allDays.map((day) => {
              const dateInfo = getDateInfo(day);
              const isCurrentMonth = dateFns.isSameMonth(day, currentDate);
              const isHovered = hoveredDate === dateInfo.date;
              const hasSession = dateInfo.sessionCount > 0;
              const dayNumber = dateFns.format(day, "d");

              return (
                <div
                  key={day.toISOString()}
                  className={`
                    relative p-2 min-h-[3rem] border rounded-lg cursor-pointer transition-[background-color,box-shadow,opacity,transform] duration-200
                    ${!isCurrentMonth ? "opacity-30" : ""}
                    ${dateFns.isToday(day) ? "ring-2 ring-primary" : ""}
                    ${hasSession ? "cursor-pointer hover:scale-105" : ""}
                    ${isHovered ? "scale-105 z-10" : ""}
                    ${
                      hasSession
                        ? getWaveHeightIntensity(dateInfo.averageWaveHeight)
                        : "bg-muted/30"
                    }
                  `}
                  onClick={() => handleDateClick(day)}
                  onMouseEnter={() => setHoveredDate(dateInfo.date)}
                  onMouseLeave={() => setHoveredDate(null)}
                  role="gridcell"
                  tabIndex={0}
                  aria-label={`${dateFns.format(day, "EEEE, MMMM d")}${
                    hasSession ? ` - ${dateInfo.sessionCount} sessions` : ""
                  }`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleDateClick(day);
                    }
                  }}
                >
                  <div className="text-sm font-medium">{dayNumber}</div>

                  {hasSession && (
                    <div className="absolute top-1 right-1">
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        {dateInfo.sessionCount}
                      </Badge>
                    </div>
                  )}

                  {hasSession && (
                    <div className="absolute bottom-1 left-1 right-1">
                      <div className="flex items-center justify-center gap-1 text-xs">
                        <Waves className="h-3 w-3" />
                        <span>{dateInfo.averageWaveHeight}ft</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Wave Height:</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900 rounded"></div>
                <span className="text-xs">0-2ft</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-blue-200 dark:bg-blue-800 rounded"></div>
                <span className="text-xs">2-4ft</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-blue-300 dark:bg-blue-700 rounded"></div>
                <span className="text-xs">4-6ft</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-blue-400 dark:bg-blue-600 rounded"></div>
                <span className="text-xs">6-8ft</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-blue-500 dark:bg-blue-500 rounded"></div>
                <span className="text-xs">8ft+</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Click on a day to view session details
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hovered Date Info */}
      {hoveredDate && sessionsByDate[hoveredDate] && (
        <Card className="absolute z-20 bg-popover p-3 shadow-lg border">
          <div className="text-sm font-medium mb-2">
            {dateFns.format(new Date(hoveredDate), "EEEE, MMMM d")}
          </div>
          <div className="space-y-1">
            {sessionsByDate[hoveredDate].map((session) => (
              <div key={session.id} className="text-xs">
                <div className="font-medium">
                  {session.beach?.name || session.beach_name}
                </div>
                <div className="text-muted-foreground">
                  {session.wave_quality}ft waves • {session.rating}/5 rating
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
