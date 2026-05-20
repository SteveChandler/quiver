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
  submitted: number;
}

export interface IndexNowBatchResult {
  totalSubmitted: number;
  batches: IndexNowResult[];
  errors: string[];
}

/**
 * Submit a batch of URLs to the IndexNow API.
 *
 * Returns 200 (OK), 202 (Accepted), or error codes.
 * Rate-limited requests return 429.
 */
export async function submitUrlsToIndexNow(
  urls: string[]
): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return { success: false, statusCode: 0, submitted: 0 };
  }

  if (urls.length === 0) {
    return { success: true, statusCode: 200, submitted: 0 };
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

  const success = response.status === 200 || response.status === 202;

  return {
    success,
    statusCode: response.status,
    submitted: success ? urls.length : 0,
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
  let totalSubmitted = 0;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);

    try {
      const result = await submitUrlsToIndexNow(batch);
      results.push(result);
      totalSubmitted += result.submitted;

      if (!result.success) {
        errors.push(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1}: HTTP ${result.statusCode}`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${message}`
      );
      results.push({ success: false, statusCode: 0, submitted: 0 });
    }
  }

  return { totalSubmitted, batches: results, errors };
}
