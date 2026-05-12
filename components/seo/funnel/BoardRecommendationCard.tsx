import { BadgeCheck, ShieldAlert } from "lucide-react";

interface BoardRecommendationCardProps {
  type: "beginner" | "longboard";
  locationName: string;
  body: string;
}

export function BoardRecommendationCard({
  type,
  locationName,
  body,
}: BoardRecommendationCardProps) {
  const Icon = type === "beginner" ? ShieldAlert : BadgeCheck;
  const title =
    type === "beginner"
      ? `Board call: ${locationName}`
      : `Log call: ${locationName}`;

  return (
    <aside className="self-start rounded-lg border border-ocean-blue/20 bg-ocean-blue/5 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-ocean-blue" aria-hidden />
        <h2 className="font-heading text-lg font-bold leading-tight text-gray-900">
          {title}
        </h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-gray-700">{body}</p>
    </aside>
  );
}
