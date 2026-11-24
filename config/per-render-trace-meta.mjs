// Sentry's config wrapper asks Next to print `sentry-trace` and `baggage` meta tags
// into each server render. Their values are new on each render, so a regenerated ISR
// page is never identical to the stored one, and Vercel bills an ISR write for a page
// whose data did not change. Sentry's client already drops these tags on ISR and SSG
// routes (`removeIsrSsgTraceMetaTags`), so the only loss is the server-to-browser
// trace link on dynamic pages. Next has no per-route switch for this option.
const PER_RENDER_TRACE_KEYS = new Set(["sentry-trace", "baggage"]);

/**
 * @template T
 * @param {T} config A Next config object, or the function form that returns one.
 * @returns {T}
 */
export function withoutPerRenderTraceMeta(config) {
  if (typeof config === "function") {
    return /** @type {T} */ (async (...args) => withoutPerRenderTraceMeta(await config(...args)));
  }

  const keys = config?.experimental?.clientTraceMetadata;
  if (!Array.isArray(keys)) return config;

  const { clientTraceMetadata: _perRender, ...experimental } = config.experimental;
  const kept = keys.filter((key) => !PER_RENDER_TRACE_KEYS.has(key));

  return {
    ...config,
    experimental: kept.length > 0 ? { ...experimental, clientTraceMetadata: kept } : experimental,
  };
}
