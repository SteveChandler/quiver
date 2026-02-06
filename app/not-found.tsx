import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Home } from "lucide-react";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist.",
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
  // No canonical - don't canonicalize 404 URLs
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-ocean-blue/10 flex items-center justify-center">
            <span className="text-4xl">🌊</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Page Not Found
        </h1>
        <p className="text-gray-600 mb-8 text-lg">
          This wave has already passed. Let&apos;s find you a better one.
        </p>
        <div className="space-y-3">
          <Link
            href="/map"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-ocean-blue text-white font-medium rounded-lg hover:bg-ocean-blue/90 transition-colors"
          >
            <MapPin className="h-5 w-5" />
            Explore Surf Spots
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Home className="h-5 w-5" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
