"use client";

import React from "react";
import { TideChart, TideDataPoint } from "./tide-chart-recharts";

// Example usage of the TideChart component
export function TideChartExample() {
  // Sample 10-day tide data
  const sampleTideData: TideDataPoint[] = [
    { time: new Date("2024-01-15T06:15:00Z"), height: 5.2, type: "high" },
    { time: new Date("2024-01-15T12:30:00Z"), height: -1.1, type: "low" },
    { time: new Date("2024-01-15T18:45:00Z"), height: 4.8, type: "high" },
    { time: new Date("2024-01-16T01:00:00Z"), height: -0.9, type: "low" },
    { time: new Date("2024-01-16T07:30:00Z"), height: 5.0, type: "high" },
    { time: new Date("2024-01-16T13:45:00Z"), height: -1.3, type: "low" },
    { time: new Date("2024-01-16T20:00:00Z"), height: 4.6, type: "high" },
    { time: new Date("2024-01-17T02:15:00Z"), height: -0.7, type: "low" },
    { time: new Date("2024-01-17T08:30:00Z"), height: 5.1, type: "high" },
    { time: new Date("2024-01-17T14:45:00Z"), height: -1.2, type: "low" },
    { time: new Date("2024-01-17T21:00:00Z"), height: 4.7, type: "high" },
    { time: new Date("2024-01-18T03:15:00Z"), height: -0.8, type: "low" },
    { time: new Date("2024-01-18T09:30:00Z"), height: 5.3, type: "high" },
    { time: new Date("2024-01-18T15:45:00Z"), height: -1.4, type: "low" },
    { time: new Date("2024-01-18T22:00:00Z"), height: 4.9, type: "high" },
    { time: new Date("2024-01-19T04:15:00Z"), height: -0.6, type: "low" },
    { time: new Date("2024-01-19T10:30:00Z"), height: 5.4, type: "high" },
    { time: new Date("2024-01-19T16:45:00Z"), height: -1.5, type: "low" },
    { time: new Date("2024-01-19T23:00:00Z"), height: 4.5, type: "high" },
    { time: new Date("2024-01-20T05:15:00Z"), height: -0.5, type: "low" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">
          TideChart Component Examples
        </h2>

        {/* Basic TideChart */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">
            Basic TideChart with "Now" Line
          </h3>
          <TideChart data={sampleTideData} />
        </div>

        {/* TideChart without "Now" line */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">
            TideChart without "Now" Line
          </h3>
          <TideChart data={sampleTideData} showNowLine={false} />
        </div>

        {/* TideChart with custom styling */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">
            TideChart with Custom Class
          </h3>
          <TideChart
            data={sampleTideData}
            className="border-2 border-blue-200 shadow-lg"
          />
        </div>

        {/* Empty state */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Empty State</h3>
          <TideChart data={[]} />
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold mb-2">Features Demonstrated:</h4>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>
            🌊 <strong>Ocean-blue area chart</strong> (#0077B6) with smooth
            monotone curves
          </li>
          <li>
            🟠 <strong>High tide scatter points</strong> in sunset orange
            (#FF7F11)
          </li>
          <li>
            ⚫ <strong>Low tide scatter points</strong> in dark grey (#333333)
          </li>
          <li>
            📍 <strong>"Now" reference line</strong> showing current time
            (toggleable)
          </li>
          <li>
            🕒 <strong>Custom tooltip</strong> with tide type, height, and time
          </li>
          <li>
            📅 <strong>X-axis</strong> with one tick per day (MMM D format)
          </li>
          <li>
            📏 <strong>Y-axis</strong> locked from -8ft to +8ft with "Tide
            height (ft)" label
          </li>
          <li>
            ⚡ <strong>Responsive design</strong> that works on all screen sizes
          </li>
          <li>
            🗂️ <strong>10-day data limit</strong> for optimal performance
          </li>
          <li>
            💎 <strong>Light dashed grid</strong> (#CCCCCC) for easy reading
          </li>
        </ul>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold mb-2">Usage:</h4>
        <pre className="text-sm bg-white p-2 rounded border overflow-x-auto">
          {`import { TideChart, TideDataPoint } from "./tide-chart-recharts";

const tideData: TideDataPoint[] = [
  { time: new Date("2024-01-15T06:15:00Z"), height: 5.2, type: "high" },
  { time: new Date("2024-01-15T12:30:00Z"), height: -1.1, type: "low" },
  // ... more data points
];

<TideChart 
  data={tideData} 
  showNowLine={true} 
  className="custom-class" 
/>`}
        </pre>
      </div>
    </div>
  );
}
