"use client";

import { useCallback, useEffect, useId, useState } from "react";

interface PlanningChecklistProps {
  items: string[];
  /** Scopes what's ticked to one city; omit to keep ticks in-memory only. */
  storageKey?: string;
}

const STORAGE_PREFIX = "quiver_checklist_";

function readTicked(key: string, count: number): boolean[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return Array(count).fill(false);
    return Array.from({ length: count }, (_, index) => parsed[index] === true);
  } catch {
    return Array(count).fill(false);
  }
}

function writeTicked(key: string, ticked: boolean[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(ticked));
  } catch {
    // Private mode or a full store: the list still works, it just won't remember.
  }
}

/**
 * The pre-drive checklist for a city. A surfer works through it once, so it
 * behaves like paper: tick it, it stays ticked, and it remembers per city.
 */
export function PlanningChecklist({ items, storageKey }: PlanningChecklistProps) {
  const listId = useId();
  const key = storageKey
    ? `${STORAGE_PREFIX}${storageKey.replace(/[^a-zA-Z0-9-_]/g, "_")}`
    : null;
  // Hooks run before the empty guard, and editorial rows can omit the list.
  const count = items?.length ?? 0;
  const [ticked, setTicked] = useState<boolean[]>(() => Array(count).fill(false));

  // Hydrate after mount so the server and first client render agree.
  useEffect(() => {
    if (!key) return;
    setTicked(readTicked(key, count));
  }, [key, count]);

  const toggle = useCallback(
    (index: number) => {
      setTicked((current) => {
        const next = current.map((value, i) => (i === index ? !value : value));
        if (key) writeTicked(key, next);
        return next;
      });
    },
    [key],
  );

  const reset = useCallback(() => {
    const cleared = Array(count).fill(false);
    setTicked(cleared);
    if (key) writeTicked(key, cleared);
  }, [count, key]);

  if (count === 0) return null;

  const done = ticked.filter(Boolean).length;
  const allDone = done === items.length;

  return (
    <aside
      aria-labelledby={`${listId}-heading`}
      data-testid="planning-checklist"
      className="mt-12 rounded-[10px_22px_8px_20px] border border-[#11100D]/20 bg-[#FBF6E8] p-5 text-[#11100D] sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${listId}-heading`} className="text-lg font-semibold">
          Planning checklist
        </h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#655C4C]" aria-live="polite">
          {done} of {items.length} checked
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {items.map((item, index) => {
          const inputId = `${listId}-${index}`;
          const isTicked = ticked[index] ?? false;
          return (
            <li key={index}>
              <label htmlFor={inputId} className="group flex cursor-pointer items-start gap-3 text-sm leading-6">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={isTicked}
                  onChange={() => toggle(index)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="mt-1 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px_5px_3px_6px] border-2 border-[#11100D] bg-[#FBF6E8] transition-colors duration-150 peer-checked:bg-[#B65F1A] peer-checked:[&>svg]:opacity-100 peer-checked:[&>svg]:[stroke-dashoffset:0] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0B3A75] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#FBF6E8] group-hover:border-[#B65F1A] motion-safe:peer-checked:animate-check-pop motion-reduce:transition-none"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3 w-3 opacity-0 transition-[opacity,stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
                    fill="none"
                    stroke="#FBF6E8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="20"
                    strokeDashoffset="20"
                  >
                    <path d="M3 8.5l3.2 3L13 4.5" />
                  </svg>
                </span>
                <span
                  className={
                    "relative transition-colors duration-200 after:absolute after:left-0 after:top-[0.72em] after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-out after:content-[''] motion-reduce:after:transition-none " +
                    (isTicked ? "text-[#655C4C] after:scale-x-100" : "")
                  }
                >
                  {item}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {allDone && (
        <p className="mt-5 flex flex-wrap items-baseline justify-between gap-3 border-t border-dashed border-[#11100D]/25 pt-4">
          <span className="-rotate-1 font-handwritten text-2xl leading-none text-[#0B3A75] motion-safe:animate-fade-in-fast">
            All ticked. Now go look at it from the sand.
          </span>
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#655C4C] underline-offset-2 hover:text-[#11100D] hover:underline"
          >
            Start over
          </button>
        </p>
      )}
    </aside>
  );
}
