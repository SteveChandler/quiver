"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Lazy load map component to avoid SSR issues
const IntelMapBeaches = dynamic(() => import("@/components/intel/intel-map-beaches"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});

const sampleBeaches = [
  { 
    id: "1", 
    name: "La Jolla Shores", 
    lat: 32.8461, 
    lon: -117.2537, 
    sizeFt: 3 
  },
  { 
    id: "2", 
    name: "Mission Beach", 
    lat: 32.7767, 
    lon: -117.2511, 
    sizeFt: 4 
  },
  { 
    id: "3", 
    name: "Ocean Beach", 
    lat: 32.7491, 
    lon: -117.2512, 
    sizeFt: 5 
  },
  { 
    id: "4", 
    name: "Pacific Beach", 
    lat: 32.7964, 
    lon: -117.2564, 
    sizeFt: 2 
  },
  { 
    id: "5", 
    name: "Del Mar Beach", 
    lat: 32.9620, 
    lon: -117.2658 
  },
];

export default function TestBeachesPage() {
  const [selectedBeachId, setSelectedBeachId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Beach Map Component Test</h1>
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">Selected Beach</h2>
          <p className="text-gray-600">
            {selectedBeachId 
              ? `Selected: ${sampleBeaches.find(b => b.id === selectedBeachId)?.name}`
              : "No beach selected"}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6" style={{ minHeight: "400px" }}>
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-2">🗺️ Beach Map Component</h3>
            <p className="text-gray-600">Interactive beach selection with smooth animations</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {sampleBeaches.map((beach, index) => (
              <button
                key={beach.id}
                onClick={() => setSelectedBeachId(beach.id)}
                className={`group relative p-4 text-left rounded-xl border-2 transition-all duration-300 ease-out ${
                  selectedBeachId === beach.id
                    ? "border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg transform scale-105 ring-4 ring-blue-200 ring-opacity-50"
                    : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-md hover:transform hover:scale-102"
                }`}
                style={{
                  animationDelay: `${index * 100}ms`
                }}
              >
                {selectedBeachId === beach.id && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                )}
                
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-2xl group-hover:scale-110 transition-transform duration-200">
                    🏄‍♂️
                  </div>
                  <div>
                    <div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">
                      {beach.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      Lat: {beach.lat.toFixed(3)}, Lon: {beach.lon.toFixed(3)}
                    </div>
                  </div>
                </div>
                
                {beach.sizeFt && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                    <span>🌊</span>
                    {beach.sizeFt}ft waves
                  </div>
                )}
              </button>
            ))}
          </div>
          
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              <span>⚡</span>
              High Performance Demo - No External Dependencies
            </div>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <h3 className="font-semibold mb-2">Features:</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Hover over markers to see lift and glow animation</li>
            <li>Click markers to select and see pulsing ring animation</li>
            <li>Selected markers show beach name and wave size in a chip</li>
            <li>All markers are keyboard accessible (Tab + Enter/Space)</li>
            <li>Markers use Framer Motion for smooth animations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}