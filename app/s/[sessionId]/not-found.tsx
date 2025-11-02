/**
 * Not Found Page for Share Route
 * Displayed when a session is private or doesn't exist
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Waves, Home, Search } from "lucide-react";

export default function ShareNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-cyan-100 dark:bg-cyan-900/20 flex items-center justify-center">
              <Waves className="w-10 h-10 text-cyan-600 dark:text-cyan-400" />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
              Session Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              This session is private, has been deleted, or doesn't exist.
            </p>
          </div>

          {/* CTAs */}
          <div className="space-y-3 pt-4">
            <Link href="/" className="block">
              <Button className="w-full" size="lg">
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </Link>

            <Link href="/map" className="block">
              <Button variant="outline" className="w-full" size="lg">
                <Search className="w-4 h-4 mr-2" />
                Explore Surf Spots
              </Button>
            </Link>
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Want to track your own surf sessions?
            </p>
            <Link href="/signup" className="text-cyan-600 hover:underline text-sm font-medium">
              Sign up for free →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
