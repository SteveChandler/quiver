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
      setMatches(allBeaches.slice(0, 50)); // show first 50 by default
    } else {
      const q = query.toLowerCase();
      const filtered = allBeaches.filter((b) => {
        const beachName = b.name.toLowerCase();
        return beachName.includes(q) || q.includes(beachName);
      });
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
    if (!beachName?.trim()) return;

    const normalizedQuery = beachName.toLowerCase().trim();

    // Try exact match first
    let found = allBeaches.find(
      (b) => b.name.toLowerCase() === normalizedQuery
    );

    // If no exact match, try partial match
    if (!found) {
      found = allBeaches.find(
        (b) =>
          b.name.toLowerCase().includes(normalizedQuery) ||
          normalizedQuery.includes(b.name.toLowerCase())
      );
    }

    if (found) {
      setQuery(found.name); // Use the actual beach name from database
      setSelectionMade(true);
      onBeachSelected(found);
    } else {
      // Fall back: accept free-typed value to proceed, with empty id
      const typed: Beach = {
        id: "",
        name: beachName.trim(),
        latitude: 0,
        longitude: 0,
        created_at: "",
        updated_at: "",
      } as any;
      setSelectionMade(true);
      onBeachSelected(typed);
    }
  };

  const noMatch = !!query && matches.length === 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectionMade(false); // Reset selection state when input changes

    // Keep parent form in sync with free-typed input so required field logic can enable submit
    const typed: Beach = {
      id: "",
      name: value,
      latitude: 0,
      longitude: 0,
      created_at: "",
      updated_at: "",
    } as any;
    onBeachSelected(typed);
  };

  const handleFocus = () => {
    setSelectionMade(false); // Always show options when focusing
  };

  const handleBlur = () => {
    // Only try to select if the user hasn't manually cleared the field
    if (query.trim()) {
      setTimeout(() => trySelect(query), 100); // Small delay to allow for clicks on dropdown items
    }
  };

  return (
    <div className="flex flex-col space-y-1">
      <div className="relative">
        <input
          id="beach-input"
          className="border rounded p-2 w-full"
          value={query}
          placeholder="Type or select a beach"
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          data-testid="beach-search-input"
        />
        {selectionMade && query && (
          <button
            type="button"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => {
              setQuery("");
              setSelectionMade(false);
              // Clear the selection in the parent component
              const emptyBeach = {
                id: "",
                name: "",
                latitude: 0,
                longitude: 0,
                created_at: "",
                updated_at: "",
              };
              onBeachSelected(emptyBeach);
            }}
            title="Clear selection"
          >
            ×
          </button>
        )}
      </div>

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

          <ul className="border rounded max-h-60 overflow-auto mt-1">
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
