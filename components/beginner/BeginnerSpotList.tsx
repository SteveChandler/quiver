import Link from "next/link";
import type { BeginnerBeachWithEditorial } from "@/types/beginner";

interface BeginnerSpotListProps {
  cityName: string;
  beaches: BeginnerBeachWithEditorial[];
}

export function BeginnerSpotList({ cityName, beaches }: BeginnerSpotListProps) {
  return (
    <section data-testid="beginner-spot-list">
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">
        Best Beginner Breaks in {cityName}
      </h2>
      <div className="space-y-4">
        {beaches.map((beach, idx) => (
          <div
            key={beach.id}
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-sky-200 hover:bg-slate-50/50 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-sky-100 text-sky-700 text-sm font-bold">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-slate-900">
                    <Link
                      href={`/spots/${beach.slug}`}
                      className="hover:text-ocean-blue hover:underline underline-offset-2"
                    >
                      {beach.name}
                    </Link>
                  </h3>
                  {beach.rating > 0 && (
                    <span className="text-sm text-slate-500">
                      ★ {beach.rating.toFixed(1)} ({beach.reviewCount})
                    </span>
                  )}
                  {beach.breakType && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
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
                    <p className="mt-2 text-sm text-slate-700">
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
                                className="text-xs text-slate-600 flex items-start gap-1.5"
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
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      {beach.editorial.logistics.parking && (
                        <span>
                          <span aria-hidden="true">🅿️</span> {beach.editorial.logistics.parking}
                        </span>
                      )}
                      {beach.editorial.logistics.lifeguards && (
                        <span><span aria-hidden="true">🏊</span> Lifeguards</span>
                      )}
                      {beach.editorial.logistics.bestHours && (
                        <span>
                          <span aria-hidden="true">⏰</span> Best: {beach.editorial.logistics.bestHours}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
