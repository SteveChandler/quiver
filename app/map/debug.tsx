"use client";

import { useEffect } from "react";

export default function MapDebugPage() {
  useEffect(() => {
    console.warn("🔥 DEBUG MAP PAGE LOADED - JavaScript is working!");
    
    // Force trigger beach data loading directly
    const triggerMapLoad = async () => {
      try {
        console.warn("🔥 Attempting to load nearby beaches...");
        
        // Use default Ocean Beach coordinates
        const lat = 32.7503;
        const lng = -117.2534;
        
        const response = await fetch('/api/beaches/nearby', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitude: lat,
            longitude: lng,
            radius: 30
          })
        });
        
        const data = await response.json();
        console.warn("🔥 Beach data response:", data);
        
        // If successful, redirect back to normal map
        if (data.success) {
          setTimeout(() => {
            window.location.href = "/map";
          }, 2000);
        }
        
      } catch (error) {
        console.error("🔥 Error loading beaches:", error);
      }
    };
    
    triggerMapLoad();
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-4">🔥 Debug Map Page</h1>
      <p className="text-lg">JavaScript is working! Check console for beach data loading...</p>
      <div className="mt-4 p-4 bg-blue-100 rounded-lg">
        <p>Testing beach data fetch with Ocean Beach coordinates:</p>
        <p>Lat: 32.7503, Lng: -117.2534</p>
      </div>
    </div>
  );
}