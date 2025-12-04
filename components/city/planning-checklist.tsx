"use client";

interface PlanningChecklistProps {
  items: string[];
}

/**
 * Planning Checklist Component
 *
 * Compact footer with actionable checklist items for session planning.
 * Displays as a styled list with sky-colored dash markers.
 */
export function PlanningChecklist({ items }: PlanningChecklistProps) {
  if (!items || items.length === 0) return null;

  return (
    <aside className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-3">
        Planning Checklist
      </h2>
      <ul className="space-y-2 text-sm text-slate-700">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-sky-600 mt-0.5">-</span>
            {item}
          </li>
        ))}
      </ul>
    </aside>
  );
}
