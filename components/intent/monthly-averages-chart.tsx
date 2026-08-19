"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import type { MonthlyWaterTempAvg } from "@/actions/forecast/intent-forecast-actions";

interface MonthlyAveragesChartProps {
  data: MonthlyWaterTempAvg[] | null;
}

export function MonthlyAveragesChart({ data }: MonthlyAveragesChartProps) {
  if (!data || data.length < 3) return null;

  const currentMonth = new Date().getMonth() + 1;

  return (
    <section id="seasonal-trends">
      <Card className="overflow-hidden rounded-2xl border-slate-200/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-heading text-gray-800">
            <Calendar className="h-5 w-5 text-cyan-600" />
            Monthly Water Temperature
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}°`}
                  width={35}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const label =
                      name === "avgTempF"
                        ? "Average"
                        : name === "minTempF"
                          ? "Min"
                          : "Max";
                    return [`${Math.round(value)}°F`, label];
                  }}
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="avgTempF" radius={[4, 4, 0, 0]}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.month}
                      fill={
                        entry.month === currentMonth ? "#0891b2" : "#a5f3fc"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Based on historical forecast data. Current month highlighted.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
