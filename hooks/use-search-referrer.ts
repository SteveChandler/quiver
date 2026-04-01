"use client";

import { useState, useEffect } from "react";

const SESSION_KEY = "quiver_search_referral";

interface SearchReferralResult {
  isSearchReferral: boolean;
  searchEngine: string | null;
}

const SSR_DEFAULT: SearchReferralResult = {
  isSearchReferral: false,
  searchEngine: null,
};

/**
 * Detects whether the current visitor arrived from a search engine.
 *
 * Checks document.referrer first, then falls back to the qvr_referrer cookie
 * set by attribution middleware. Caches the result in sessionStorage so it
 * survives client-side navigations within the same tab.
 */
export function useSearchReferrer(): SearchReferralResult {
  const [result, setResult] = useState<SearchReferralResult>(SSR_DEFAULT);

  useEffect(() => {
    // Check sessionStorage cache first
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as SearchReferralResult;
        setResult(parsed);
        return;
      }
    } catch {
      // Storage unavailable
    }

    const detected = detectSearchEngine(document.referrer) ?? detectFromCookie();
    const value: SearchReferralResult = detected
      ? { isSearchReferral: true, searchEngine: detected }
      : SSR_DEFAULT;

    // Cache for the session
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    } catch {
      // Storage unavailable
    }

    setResult(value);
  }, []);

  return result;
}

function detectSearchEngine(referrer: string): string | null {
  if (!referrer) return null;

  try {
    const hostname = new URL(referrer).hostname.toLowerCase();

    if (hostname.includes("google.")) return "google";
    if (hostname.includes("bing.com")) return "bing";
    if (hostname.includes("duckduckgo.com")) return "duckduckgo";
    if (hostname.includes("search.yahoo.com")) return "yahoo";
  } catch {
    // Malformed referrer URL
  }

  return null;
}

function detectFromCookie(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split("=");
    if (key === "qvr_referrer" && value) {
      return detectSearchEngine(decodeURIComponent(value));
    }
  }

  return null;
}
