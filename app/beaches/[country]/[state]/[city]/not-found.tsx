import Link from "next/link";
import { MapPin, ChevronLeft } from "lucide-react";

/**
 * Custom 404 page for invalid beach locations
 *
 * Displayed when a user navigates to a location URL that doesn't exist
 * in the database (e.g., /beaches/usa/ca/fake-city).
 *
 * Provides helpful messaging and navigation back to the map view.
 */
export default function LocationNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-ocean-blue/10 flex items-center justify-center">
            <MapPin className="h-10 w-10 text-ocean-blue" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Location Not Found
        </h1>

        {/* Description */}
        <p className="text-gray-600 mb-8 text-lg">
          We couldn&apos;t find any beaches in this location. This area might not have surf spots in our database yet.
        </p>

        {/* Help Text */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8 text-left">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Looking for surf spots?
          </h2>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-ocean-blue mt-0.5">•</span>
              <span>Browse all beaches on our interactive map</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-ocean-blue mt-0.5">•</span>
              <span>Try a nearby coastal city or neighborhood</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-ocean-blue mt-0.5">•</span>
              <span>Check if the location name is spelled correctly</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/map"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-ocean-blue text-white font-medium rounded-lg hover:bg-ocean-blue/90 transition-colors"
          >
            <MapPin className="h-5 w-5" />
            Browse All Beaches on Map
          </Link>

          <Link
            href="/beaches"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            Back to Locations
          </Link>
        </div>

        {/* Feedback Link */}
        <p className="mt-8 text-sm text-gray-500">
          Think this location should be listed?{" "}
          <a
            href="https://github.com/anthropics/quiver/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ocean-blue hover:underline"
          >
            Let us know
          </a>
        </p>
      </div>
    </div>
  );
}
