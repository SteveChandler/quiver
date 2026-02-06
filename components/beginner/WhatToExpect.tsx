import type { BeginnerCityEditorial } from "@/types/beginner";

interface WhatToExpectProps {
  cityName: string;
  cityEditorial: BeginnerCityEditorial;
}

export function WhatToExpect({ cityName, cityEditorial }: WhatToExpectProps) {
  if (cityEditorial.description.length <= 1) return null;

  return (
    <section data-testid="what-to-expect">
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">
        What to Expect Surfing in {cityName}
      </h2>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 space-y-4">
        {cityEditorial.description.slice(1).map((paragraph, idx) => (
          <p key={idx} className="text-sm text-slate-700 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
