"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Beach } from "@/types/database";

export function BeachSelector({
  onBeachSelected,
  initialValue,
}: {
  onBeachSelected: (beach: Beach) => void;
  initialValue?: string;
}) {
  const supabase = createClient();
  const [allBeaches, setAllBeaches] = useState<Beach[]>([]);
  const [query, setQuery] = useState(initialValue || "");
  const [matches, setMatches] = useState<Beach[]>([]);
  const [selectionMade, setSelectionMade] = useState(!!initialValue);

  // 1. Fetch all beaches once on mount
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("beaches")
        .select("*")
        .order("name", { ascending: true });
      if (error) {
        console.error("Error loading beaches:", error);
      } else {
        setAllBeaches(data || []);
      }
    };
    load();
  }, [supabase]);

  // 2. Whenever query changes, recompute our filtered list
  useEffect(() => {
    if (!query) {
      setMatches(allBeaches.slice(0, 10)); // show first 10 by default
    } else {
      const q = query.toLowerCase();
      const filtered = allBeaches.filter((b) =>
        b.name.toLowerCase().startsWith(q)
      );
      setMatches(filtered);
    }
  }, [query, allBeaches]);

  // Set initial value when it changes
  useEffect(() => {
    if (initialValue && initialValue !== query) {
      setQuery(initialValue);
      setSelectionMade(true);
    }
  }, [initialValue, query]);

  // 3. When the user picks something (click or select)
  const trySelect = (beachName: string) => {
    const found = allBeaches.find((b) => b.name === beachName);
    if (found) {
      setQuery(beachName);
      setSelectionMade(true);
      onBeachSelected(found);
    }
  };

  const noMatch = !!query && matches.length === 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectionMade(false); // Reset selection state when input changes
  };

  return (
    <div className="flex flex-col space-y-1">
      <label htmlFor="beach-input" className="font-medium text-sm">
        Where are you surfing?
      </label>
      <input
        id="beach-input"
        className="border rounded p-2"
        value={query}
        placeholder="Type or select a beach"
        onChange={handleInputChange}
        onBlur={() => trySelect(query)}
        onFocus={() => setSelectionMade(false)} // Show options when focusing back on input
      />

      {!selectionMade && (
        <>
          <datalist id="beach-list">
            {matches.map((b) => (
              <option key={b.id} value={b.name} />
            ))}
          </datalist>

          {noMatch && (
            <p className="text-red-500 text-sm">
              Please select something from the drop down.
            </p>
          )}

          <ul className="border rounded max-h-40 overflow-auto mt-1">
            {matches.map((b) => (
              <li
                key={b.id}
                className="p-2 hover:bg-gray-100 cursor-pointer"
                onMouseDown={() => {
                  setQuery(b.name);
                  trySelect(b.name);
                }}
              >
                {b.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
