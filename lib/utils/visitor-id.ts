import { safeGetItem, safeSetItem, safeRemoveItem } from "@/lib/utils/safe-storage";

const VISITOR_ID_KEY = "quiver_visitor_id";

/** Get or create a persistent visitor ID (UUID in localStorage) */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";

  const existing = safeGetItem(VISITOR_ID_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  safeSetItem(VISITOR_ID_KEY, id);
  return id;
}

/** Get existing visitor ID without creating one */
export function getExistingVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  return safeGetItem(VISITOR_ID_KEY);
}

/** Clear visitor ID (call after linking to authenticated user) */
export function clearVisitorId(): void {
  if (typeof window === "undefined") return;
  safeRemoveItem(VISITOR_ID_KEY);
}
