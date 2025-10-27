"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Waves, Wind, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getBlurPlaceholder } from "@/lib/constants/blur-placeholders";

export interface SurfSpotCardProps {
  id: string;
  name: string;
  location: string;
  imageUrl?: string | null;
  swellHeight?: string;
  swellDirection?: string;
  windSpeed?: string;
  tideStatus?: string;
  difficulty?: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  crowdLevel?: "Uncrowded" | "Moderate" | "Crowded";
  delay?: number;
}

const DIFFICULTY_COLORS = {
  Beginner: "bg-green-100 text-green-800 border-green-300",
  Intermediate: "bg-blue-100 text-blue-800 border-blue-300",
  Advanced: "bg-orange-100 text-orange-800 border-orange-300",
  Expert: "bg-red-100 text-red-800 border-red-300",
};

const CROWD_COLORS = {
  Uncrowded: "bg-green-100 text-green-800",
  Moderate: "bg-yellow-100 text-yellow-800",
  Crowded: "bg-red-100 text-red-800",
};

/**
 * Get blur placeholder for an image URL
 * Extracts filename from URL and looks up the placeholder
 */
function getImagePlaceholder(imageUrl: string): string | undefined {
  // Extract filename without extension from image URL
  const filename = imageUrl
    .split("/")
    .pop()
    ?.replace(/\.(webp|jpg|jpeg|png)$/i, "");

  return filename ? getBlurPlaceholder(filename) : undefined;
}

export function SurfSpotCard({
  id,
  name,
  location,
  imageUrl,
  swellHeight,
  swellDirection,
  windSpeed,
  tideStatus,
  difficulty,
  crowdLevel,
  delay = 0,
}: SurfSpotCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: delay * 0.1 }}
    >
      <Link href={`/beach/${id}`} className="block group">
        <div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          {/* Image Section */}
          <div className="relative h-48 bg-gradient-to-br from-ocean-blue to-blue-400 overflow-hidden">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={name}
                fill
                loading="lazy"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                placeholder={getImagePlaceholder(imageUrl) ? "blur" : "empty"}
                blurDataURL={getImagePlaceholder(imageUrl)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Waves className="h-16 w-16 text-white/40" />
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-4">
            {/* Name and Location */}
            <h3 className="text-lg font-bold font-roboto text-dark-grey mb-1 group-hover:text-ocean-blue transition-colors">
              {name}
            </h3>
            <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
              <MapPin className="h-4 w-4" />
              <span>{location}</span>
            </div>

            {/* Conditions Summary */}
            {(swellHeight || windSpeed || tideStatus) && (
              <div className="space-y-2 mb-3">
                {swellHeight && (
                  <div className="flex items-center gap-2 text-sm">
                    <Waves className="h-4 w-4 text-ocean-blue" />
                    <span className="text-gray-700">
                      <span className="font-semibold">{swellHeight}</span>
                      {swellDirection && (
                        <span className="text-gray-500 ml-1">
                          {swellDirection}
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {windSpeed && (
                  <div className="flex items-center gap-2 text-sm">
                    <Wind className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-700">{windSpeed}</span>
                  </div>
                )}

                {tideStatus && (
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-700">{tideStatus}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {difficulty && (
                <Badge
                  variant="outline"
                  className={DIFFICULTY_COLORS[difficulty]}
                >
                  {difficulty}
                </Badge>
              )}

              {crowdLevel && (
                <Badge variant="outline" className={CROWD_COLORS[crowdLevel]}>
                  <Users className="h-3 w-3 mr-1" />
                  {crowdLevel}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
