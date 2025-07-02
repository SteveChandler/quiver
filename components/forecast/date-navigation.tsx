"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { isToday } from "@/lib/utils/forecast-ui-utils";

interface DateNavigationProps {
  availableDates: string[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

export function DateNavigation({
  availableDates,
  selectedDate,
  onDateSelect,
}: DateNavigationProps) {
  if (availableDates.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
      {availableDates.map((date) => {
        const isSelected = date === selectedDate;
        const dateObj = new Date(date);
        const isTodayDate = isToday(date);

        return (
          <Button
            key={date}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onDateSelect(date)}
            className="h-auto py-2 flex flex-col"
          >
            <span className="text-xs">
              {isTodayDate
                ? "Today"
                : dateObj.toLocaleDateString([], {
                    weekday: "short",
                  })}
            </span>
            <span className="font-medium">
              {dateObj.toLocaleDateString([], { day: "numeric" })}
            </span>
            <span className="text-xs">
              {dateObj.toLocaleDateString([], { month: "short" })}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
