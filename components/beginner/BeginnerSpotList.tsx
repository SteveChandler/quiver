import Image from "next/image";
import Link from "next/link";
import { Waves } from "lucide-react";
import type { BeginnerBeachWithEditorial } from "@/types/beginner";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";

interface BeginnerSpotListProps {
  cityName: string;
  stateSlug: string;
  citySlug: string;
  beaches: BeginnerBeachWithEditorial[];
}

export function BeginnerSpotList({ cityName, stateSlug, citySlug, beaches }: BeginnerSpotListProps) {
  return (
    <section data-testid="beginner-spot-list">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Best Beginner Breaks in {cityName}
      </h2>
      <div className="space-y-4">
        {beaches.map((beach, idx) => (
          <div
            key={beach.id}
            className="rounded-xl border border-blue-100/50 bg-gradient-to-br from-white/90 to-blue-50/30 shadow-sm hover:border-blue-200 hover:shadow-md transition-[border-color,box-shadow] overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row">
              {/* Photo thumbnail */}
              <div className="relative sm:w-[160px] sm:flex-shrink-0">
                {beach.photoUrl ? (
                  <Image
                    src={beach.photoUrl}
                    alt={`${beach.name} beach`}
                    width={320}
                    height={180}
                    className="h-36 sm:h-full w-full object-cover"
                    sizes="(max-width: 640px) 100vw, 160px"
                  />
                ) : (
                  <div className="h-36 sm:h-full w-full bg-gradient-to-br from-blue-50 to-sky-100 flex items-center justify-center">
                    <Waves className="h-8 w-8 text-blue-300" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-blue-50 text-ocean-blue text-sm font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-800">
                        <Link
                          href={buildBeachUrl({
                            slug: beach.slug,
                            city: beach.city || cityName || citySlug,
                            state: beach.state || stateSlug,
                          })}
                          className="hover:text-ocean-blue hover:underline underline-offset-2"
                        >
                          {beach.name}
                        </Link>
                      </h3>
                      {beach.rating > 0 && (
                        <span className="text-sm text-gray-500">
                          ★ {beach.rating.toFixed(1)} ({beach.reviewCount})
                        </span>
                      )}
                      {beach.breakType && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                          {beach.breakType}
                        </span>
                      )}
                      {beach.currentWaveHeight && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                          {beach.currentWaveHeight} today
                        </span>
                      )}
                    </div>

                    {beach.editorial && (
                      <>
                        <p className="mt-2 text-sm text-gray-700">
                          {beach.editorial.description}
                        </p>
                        {beach.editorial.whyBeginnersLoveIt.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-green-700 mb-1">
                              Why beginners love it:
                            </p>
                            <ul className="grid gap-1 sm:grid-cols-2">
                              {beach.editorial.whyBeginnersLoveIt
                                .slice(0, 4)
                                .map((reason) => (
                                  <li
                                    key={reason}
                                    className="text-xs text-gray-600 flex items-start gap-1.5"
                                  >
                                    <span className="text-green-500 mt-0.5">
                                      &#10003;
                                    </span>
                                    {reason}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                          {beach.editorial.logistics.parking && (
                            <span>
                              <span aria-hidden="true">🅿️</span>{" "}
                              {beach.editorial.logistics.parking}
                            </span>
                          )}
                          {beach.editorial.logistics.lifeguards && (
                            <span>
                              <span aria-hidden="true">🏊</span> Lifeguards
                            </span>
                          )}
                          {beach.editorial.logistics.bestHours && (
                            <span>
                              <span aria-hidden="true">⏰</span> Best:{" "}
                              {beach.editorial.logistics.bestHours}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
