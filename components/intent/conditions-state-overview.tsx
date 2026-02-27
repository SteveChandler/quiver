import Link from "next/link";
import { Thermometer, Sunrise, Sunset } from "lucide-react";
import { buildCityIntentUrl, type IntentKey } from "@/lib/constants/intent-definitions";
import {
  getStateWaterTempOverview,
  getStateSunTimesOverview,
} from "@/actions/forecast/intent-forecast-actions";

interface ConditionsStateOverviewProps {
  intentKey: IntentKey;
  stateName: string;
  stateSlug: string;
}

/**
 * ConditionsStateOverview - Replaces PopularCitiesForIntent for conditions intents.
 * Shows meaningful regional data (temps, sun times) instead of generic "popular cities."
 * MUST still render links to city intent pages to preserve SEO crawl loop.
 */
export async function ConditionsStateOverview({
  intentKey,
  stateName,
  stateSlug,
}: ConditionsStateOverviewProps) {
  if (intentKey === "water-temp") {
    const cities = await getStateWaterTempOverview(stateSlug);
    if (cities.length === 0) return null;

    return (
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Water Temperature Across {stateName}
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Current water temperatures from north to south. Click a city for detailed conditions and wetsuit recommendations.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">City</th>
                <th className="px-4 py-3 font-medium text-slate-600">Water Temp</th>
                <th className="px-4 py-3 font-medium text-slate-600">Wetsuit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cities.map((city) => (
                <tr key={city.citySlug} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <Link
                      href={buildCityIntentUrl("water-temp", city.citySlug)}
                      className="text-ocean-blue hover:underline font-medium"
                    >
                      {city.cityName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <Thermometer className="h-4 w-4 text-cyan-600" />
                      {Math.round(city.tempF)}°F
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{city.wetsuitThickness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (intentKey === "dawn-patrol" || intentKey === "sunset") {
    const cities = await getStateSunTimesOverview(stateSlug);
    if (cities.length === 0) return null;

    const isDawnPatrol = intentKey === "dawn-patrol";
    const heading = isDawnPatrol
      ? `Sunrise Times Across ${stateName}`
      : `Sunset Times Across ${stateName}`;
    const description = isDawnPatrol
      ? "Sunrise and first light times from north to south. Click a city for detailed dawn patrol planning."
      : "Sunset and golden hour times from north to south. Click a city for detailed evening session planning.";

    return (
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          {heading}
        </h2>
        <p className="text-sm text-gray-600 mb-6">{description}</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">City</th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  {isDawnPatrol ? "Sunrise" : "Sunset"}
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  {isDawnPatrol ? "First Light" : "Golden Hour"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cities.map((city) => (
                <tr key={city.citySlug} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <Link
                      href={buildCityIntentUrl(intentKey, city.citySlug)}
                      className="text-ocean-blue hover:underline font-medium"
                    >
                      {city.cityName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      {isDawnPatrol ? (
                        <Sunrise className="h-4 w-4 text-indigo-500" />
                      ) : (
                        <Sunset className="h-4 w-4 text-amber-500" />
                      )}
                      {isDawnPatrol ? city.sunrise : city.sunset}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {isDawnPatrol ? city.firstLight : city.goldenHourStart}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // Tide and other conditions intents: return null (caller should use PopularCitiesForIntent)
  return null;
}
