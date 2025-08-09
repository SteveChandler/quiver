export async function fetchWithTimeout(
  input: RequestInfo | URL,
  opts: { timeoutMs?: number; init?: RequestInit } = {}
): Promise<Response> {
  const { timeoutMs = 12000, init } = opts;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, {
      ...(init || {}),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}
