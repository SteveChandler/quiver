import type { LucideIcon } from "lucide-react";

interface GradientEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function GradientEmptyState({
  icon: Icon,
  title,
  description,
}: GradientEmptyStateProps) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 p-6 text-center">
      <Icon className="h-8 w-8 text-ocean-blue mx-auto mb-2" />
      <p className="text-sm font-medium text-gray-900 mb-1">{title}</p>
      <p className="text-xs text-gray-600">{description}</p>
    </div>
  );
}
