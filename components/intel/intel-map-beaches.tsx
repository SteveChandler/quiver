"use client";

import { useCallback, useMemo, useState } from "react";
import Map, { Marker } from "react-map-gl/mapbox";
import { motion, AnimatePresence } from "framer-motion";

interface Beach {
  id: string;
  name: string;
  lat: number;
  lon: number;
  sizeFt?: number;
}

interface IntelMapProps {
  beaches: Beach[];
  selectedBeachId?: string | null;
  onSelectBeach?: (id: string) => void;
  initialView?: { latitude: number; longitude: number; zoom: number };
  mapStyle?: string;
  mapToken?: string;
}

// Default view for San Diego
const DEFAULT_VIEW = {
  latitude: 32.7157,
  longitude: -117.1611,
  zoom: 10,
};

// Optimized animation variants - reduced complexity for better performance
const markerVariants = {
  default: {
    scale: 1,
    y: 0,
    transition: { duration: 0 }, // No animation on initial mount
  },
  hover: {
    scale: 1.15, // Reduced scale for better performance
    y: -3,
    transition: { duration: 0.15 }, // Faster transitions
  },
  selected: {
    scale: 1.3, // Reduced scale
    y: -6,
    transition: { duration: 0.2 },
  },
};

const ringVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: [1, 1.5, 1],
    opacity: [0.8, 0.3, 0.8],
    transition: {
      duration: 2,
      repeat: Infinity,
      repeatType: "loop" as const,
      ease: "easeInOut",
    },
  },
  exit: { scale: 0.8, opacity: 0, transition: { duration: 0.2 } },
};

const labelVariants = {
  hidden: { y: 10, opacity: 0, scale: 0.9 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { type: "spring", damping: 20, stiffness: 500 },
  },
  exit: { y: -10, opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
};

export default function IntelMapBeaches({
  beaches,
  selectedBeachId,
  onSelectBeach,
  initialView = DEFAULT_VIEW,
  mapStyle = "mapbox://styles/mapbox/light-v11",
  mapToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
}: IntelMapProps) {
  const [hoveredBeachId, setHoveredBeachId] = useState<string | null>(null);

  // Memoized marker component for performance
  const BeachMarker = useMemo(
    () =>
      function BeachMarkerComponent({ beach }: { beach: Beach }) {
        const isSelected = selectedBeachId === beach.id;
        const isHovered = hoveredBeachId === beach.id;

        const handleClick = useCallback(() => {
          onSelectBeach?.(beach.id);
        }, [beach.id]);

        const handleMouseEnter = useCallback(() => {
          setHoveredBeachId(beach.id);
        }, [beach.id]);

        const handleMouseLeave = useCallback(() => {
          setHoveredBeachId(null);
        }, []);

        const handleKeyDown = useCallback(
          (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectBeach?.(beach.id);
            }
          },
          [beach.id]
        );

        const getVariant = () => {
          if (isSelected) return "selected";
          if (isHovered) return "hover";
          return "default";
        };

        return (
          <Marker key={beach.id} latitude={beach.lat} longitude={beach.lon}>
            <div className="relative">
              {/* Selection ring with ping animation */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    className="absolute inset-0 -m-2 rounded-full border-2 border-blue-500 pointer-events-none"
                    variants={ringVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    style={{
                      width: "48px",
                      height: "48px",
                      top: "-12px",
                      left: "-12px",
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Beach marker button */}
              <motion.button
                className="relative w-6 h-6 bg-blue-500 border-2 border-white rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer flex items-center justify-center text-white font-bold text-xs"
                variants={markerVariants}
                initial="default"
                animate={getVariant()}
                whileTap={{ scale: 0.9 }}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onKeyDown={handleKeyDown}
                aria-pressed={isSelected}
                aria-label={`${beach.name}${beach.sizeFt ? `, ${beach.sizeFt}ft waves` : ""}`}
                tabIndex={0}
                style={{ transformOrigin: "center" }}
              >
                🏄‍♂️
              </motion.button>

              {/* Beach label chip */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg px-3 py-1 pointer-events-none whitespace-nowrap z-10"
                    variants={labelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <div className="text-sm font-semibold text-gray-800">
                      {beach.name}
                    </div>
                    {beach.sizeFt && (
                      <div className="text-xs text-blue-600 font-medium">
                        {beach.sizeFt}ft waves
                      </div>
                    )}
                    {/* Arrow pointing down */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Marker>
        );
      },
    [selectedBeachId, hoveredBeachId, onSelectBeach]
  );

  // Memoized markers to prevent unnecessary re-renders
  const markers = useMemo(
    () => beaches.map((beach) => <BeachMarker key={beach.id} beach={beach} />),
    [beaches, BeachMarker]
  );

  return (
    <div className="relative w-full h-full">
      <Map
        mapboxAccessToken={mapToken}
        initialViewState={initialView}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        interactiveLayerIds={[]}
        attributionControl={true}
        reuseMaps
      >
        {markers}
      </Map>
    </div>
  );
}