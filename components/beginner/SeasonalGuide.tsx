interface SeasonalGuideProps {
  cityName: string;
}

const SEASONS = [
  { season: "Spring", months: "Mar-May", color: "bg-amber-50 border-amber-200" },
  { season: "Summer", months: "Jun-Aug", color: "bg-green-50 border-green-200" },
  { season: "Fall", months: "Sep-Nov", color: "bg-amber-50 border-amber-200" },
  { season: "Winter", months: "Dec-Feb", color: "bg-red-50 border-red-200" },
] as const;

export function SeasonalGuide({ cityName }: SeasonalGuideProps) {
  return (
    <section data-testid="seasonal-guide">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Best Months for Beginner Surfing
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {SEASONS.map(({ season, months, color }) => (
          <div key={season} className={`rounded-xl border p-4 ${color}`}>
            <h3 className="text-lg font-semibold text-gray-800">{season}</h3>
            <p className="text-xs text-gray-600 mb-2">{months}</p>
            <p className="text-sm text-gray-700">
              Conditions for beginners in {cityName} during{" "}
              {season.toLowerCase()}.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
