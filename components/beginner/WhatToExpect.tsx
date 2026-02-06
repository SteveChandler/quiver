import type { BeginnerCityEditorial } from "@/types/beginner";

interface WhatToExpectProps {
  cityName: string;
  cityEditorial: BeginnerCityEditorial;
}

export function WhatToExpect({ cityName, cityEditorial }: WhatToExpectProps) {
  if (cityEditorial.description.length <= 1) return null;

  return (
    <section data-testid="what-to-expect">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        What to Expect Surfing in {cityName}
      </h2>
      <div className="rounded-2xl border border-blue-200/50 bg-gradient-to-br from-white/80 to-blue-50/60 backdrop-blur-sm shadow-lg p-6 space-y-4">
        {cityEditorial.description.slice(1).map((paragraph, idx) => (
          <p key={idx} className="text-sm text-gray-700 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
