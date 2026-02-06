import { Backpack } from "lucide-react";

export function GearAndLessons() {
  return (
    <section data-testid="gear-and-lessons">
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">
        <Backpack className="inline h-5 w-5 text-sky-600 mr-2" aria-hidden="true" />
        Gear &amp; Lessons
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Board Guide
          </h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>Soft-top foam board, 8-9 ft for adults</li>
            <li>7-8 ft for teens and smaller adults</li>
            <li>Avoid fiberglass boards until you can consistently pop up</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Wetsuit Guide
          </h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              Check the water temperature above for today&apos;s recommendation
            </li>
            <li>Boardshorts/bikini for water above 70&deg;F</li>
            <li>3/2mm fullsuit for water below 60&deg;F</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
