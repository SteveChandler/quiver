export interface ResilientFetchOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;

export async function fetchWithRetry(
  url: string | URL,
  init: RequestInit = {},
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const localNetworkBlocker = getLocalNetworkBlocker();
  if (localNetworkBlocker) {
    throw new Error(localNetworkBlocker);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: mergeSignals(init.signal ?? undefined, timeoutSignal(timeoutMs)),
      });

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      if ((response.status >= 500 || response.status === 429) && attempt < retries) {
        await sleep(retryDelayMs * attempt);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (!isRemoteFetchError(error) || attempt >= retries) {
        throw error;
      }
      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

export async function fetchJsonWithRetry<T>(
  url: string | URL,
  init: RequestInit = {},
  options: ResilientFetchOptions = {},
): Promise<T> {
  const response = await fetchWithRetry(url, init, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchTextWithRetry(
  url: string | URL,
  init: RequestInit = {},
  options: ResilientFetchOptions = {},
): Promise<string> {
  const response = await fetchWithRetry(url, init, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

export function normalizeFetchError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim().length > 0 ? error.message : "fetch failed";
  }
  const value = String(error);
  return value.trim().length > 0 ? value : "fetch failed";
}

export function isRemoteFetchError(error: unknown): boolean {
  const message = normalizeFetchError(error).toLowerCase();
  return [
    "codex_sandbox_network_disabled",
    "enotfound",
    "econnreset",
    "timed out",
    "timeout",
    "fetch failed",
    "network",
    "eai_again",
    "http ",
    " failed:",
  ].some((token) => message.includes(token));
}

export function getLocalNetworkBlocker(): string | null {
  if (process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1") {
    return "Local network unavailable: CODEX_SANDBOX_NETWORK_DISABLED=1";
  }
  return null;
}

function mergeSignals(existing?: AbortSignal, timeout?: AbortSignal): AbortSignal | undefined {
  if (!existing) return timeout;
  if (!timeout) return existing;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([existing, timeout]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  existing.addEventListener("abort", abort, { once: true });
  timeout.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error(`Timeout after ${ms}ms`)), ms);
  return controller.signal;
}
