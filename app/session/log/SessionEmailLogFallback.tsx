"use client";

import Link from "next/link";
import { useState } from "react";
import { logSession } from "./actions";

type Rating = "skip" | "good" | "fired";

const RATING_OPTIONS: { value: Rating; label: string; emoji: string }[] = [
  { value: "skip", label: "Skipped it", emoji: "👎" },
  { value: "good", label: "Good sesh", emoji: "👍" },
  { value: "fired", label: "Fired!", emoji: "🔥" },
];

interface SessionEmailLogFallbackProps {
  token: string | null;
  beachId: string | null;
  windowStart: string | null;
  beachName?: string | null;
  score?: string | null;
}

export function SessionEmailLogFallback({
  token,
  beachId,
  windowStart,
  beachName = "your session",
  score,
}: SessionEmailLogFallbackProps) {
  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || !beachId || !windowStart) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-semibold text-red-600 mb-2">Missing Info</h1>
          <p className="text-gray-600">Please use the link from your email.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!selectedRating) return;

    setIsSaving(true);
    setError(null);

    const result = await logSession(
      token,
      beachId,
      windowStart,
      selectedRating,
      notes || undefined,
      score ? parseFloat(score) : undefined
    );

    if (result.success) {
      setSaved(true);
    } else {
      setError(result.error || "Failed to save");
    }

    setIsSaving(false);
  };

  if (saved) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-xl font-semibold text-green-600 mb-2">Logged!</h1>
          <p className="text-gray-600 mb-6">
            Thanks for the feedback. This helps us get smarter.
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            Open Quiver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 mt-8">
          How was it?
        </h1>
        <p className="text-gray-600 mb-6">{beachName || "your session"}</p>

        <div className="flex gap-3 mb-6">
          {RATING_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedRating(option.value)}
              className={`flex-1 py-4 px-2 rounded-lg border-2 transition-colors ${
                selectedRating === option.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }` + " focus-ring"}
            >
              <div className="text-3xl mb-1">{option.emoji}</div>
              <div className="text-sm font-medium text-gray-700">
                {option.label}
              </div>
            </button>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How were the waves? Crowd? Conditions?"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedRating || isSaving}
          className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
