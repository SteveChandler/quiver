/**
 * IndexNow submission service.
 *
 * Submits URLs to the IndexNow API for accelerated search engine discovery
 * by Google, Bing, Yandex, and other participating engines.
 *
 * Protocol: https://www.indexnow.org/documentation
 *
 * IMPORTANT: The `INDEXNOW_KEY` env var MUST match the content of the key
 * verification file at `public/{key}.txt`. In production, the file is
 * `public/indexnow-key.txt` and contains the raw key string.
 */

import { SITE_URL } from "@/lib/constants/seo";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Maximum URLs per IndexNow request (protocol limit is 10,000). */
const BATCH_SIZE = 10_000;

export interface IndexNowResult {
  success: boolean;
  statusCode: number;
  /** URLs the API confirmed (HTTP 200 — key verified against keyLocation). */
  submitted: number;
  /** URLs accepted with key validation deferred (HTTP 202). Not yet delivered. */
  pending: number;
}

export interface IndexNowBatchResult {
  totalSubmitted: number;
  totalPending: number;
  batches: IndexNowResult[];
  errors: string[];
  /** Non-fatal conditions that still mean delivery is unconfirmed. */
  warnings: string[];
}

/**
 * Submit a batch of URLs to the IndexNow API.
 *
 * Only HTTP 200 counts as delivered. A 202 means IndexNow accepted the payload
 * but deferred key validation, and a key that does not match the file at
 * `keyLocation` returns 202 as often as it returns 403 (observed against the
 * live API, 2026-08-10). Counting 202 as delivered therefore made a broken key
 * indistinguishable from a working one — the weekly cron reported thousands of
 * successful submissions while Bing silently discarded every URL.
 */
export async function submitUrlsToIndexNow(
  urls: string[]
): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return { success: false, statusCode: 0, submitted: 0, pending: 0 };
  }

  if (urls.length === 0) {
    return { success: true, statusCode: 200, submitted: 0, pending: 0 };
  }

  const host = new URL(SITE_URL).host;

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `${SITE_URL}/indexnow-key.txt`,
      urlList: urls,
    }),
  });

  const verified = response.status === 200;
  const deferred = response.status === 202;

  return {
    success: verified || deferred,
    statusCode: response.status,
    submitted: verified ? urls.length : 0,
    pending: deferred ? urls.length : 0,
  };
}

/**
 * Submit URLs in batches of up to 10,000 (IndexNow protocol limit).
 */
export async function submitUrlsInBatches(
  urls: string[]
): Promise<IndexNowBatchResult> {
  const results: IndexNowResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalSubmitted = 0;
  let totalPending = 0;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const result = await submitUrlsToIndexNow(batch);
      results.push(result);
      totalSubmitted += result.submitted;
      totalPending += result.pending;

      if (!result.success) {
        errors.push(`Batch ${batchNumber}: HTTP ${result.statusCode}`);
      } else if (result.pending > 0) {
        warnings.push(
          `Batch ${batchNumber}: HTTP 202 - key validation pending, delivery unconfirmed`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(`Batch ${batchNumber}: ${message}`);
      results.push({
        success: false,
        statusCode: 0,
        submitted: 0,
        pending: 0,
      });
    }
  }

  return { totalSubmitted, totalPending, batches: results, errors, warnings };
}
