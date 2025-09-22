/**
 * Navigation utilities for preserving query parameters and handling protected routes
 */

import { ReadonlyURLSearchParams } from "next/navigation";

/**
 * Preserves specified query parameters when navigating to a new route
 * @param href - The target URL
 * @param searchParams - Current URL search parameters
 * @param preserveParams - Array of parameter names to preserve (defaults to preserving Vercel bypass token)
 * @returns URL with preserved query parameters
 */
export function preserveQueryParams(
  href: string,
  searchParams: ReadonlyURLSearchParams | null,
  preserveParams: string[] = ['x-vercel-protection-bypass']
): string {
  if (!searchParams) {
    return href;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const url = new URL(href, origin);
  
  // Preserve specified parameters
  for (const param of preserveParams) {
    const value = searchParams.get(param);
    if (value) {
      url.searchParams.set(param, value);
    }
  }

  return url.pathname + url.search;
}
