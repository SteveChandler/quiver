import { Shield } from "lucide-react";

interface SafetyEssentialsProps {
  cityName: string;
}

const SAFETY_TIPS = [
  {
    title: "Rip Currents",
    tip: "Look for channels of darker, choppy water. If caught, swim parallel to shore - never fight the current.",
  },
  {
    title: "Marine Life",
    tip: "Shuffle your feet when entering shallow water to avoid stingrays, especially in summer months.",
  },
  {
    title: "Rocks & Reef",
    tip: "Stick to sandy beach breaks as a beginner. Check with locals or lifeguards about underwater hazards.",
  },
  {
    title: "Etiquette",
    tip: "Stay on the inside as a beginner. Don't paddle into the lineup. Give right of way to surfers already riding.",
  },
] as const;

export function SafetyEssentials({ cityName }: SafetyEssentialsProps) {
  return (
    <section data-testid="safety-essentials">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        <Shield className="inline h-5 w-5 text-amber-600 mr-2" aria-hidden="true" />
        Safety Tips for {cityName}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {SAFETY_TIPS.map(({ title, tip }) => (
          <div
            key={title}
            className="rounded-lg border border-amber-200 bg-amber-50 p-4"
          >
            <h3 className="text-sm font-semibold text-amber-800">{title}</h3>
            <p className="mt-1 text-sm text-gray-700">{tip}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
