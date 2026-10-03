import { detectBot } from "@/lib/security/bot-detection";

export type HandoffTrafficClass =
  | "known_bot"
  | "preview_fetcher"
  | "prefetch"
  | "human_candidate"
  | "unverified";

export type HandoffUaClass =
  | "ios_safari"
  | "ios_other"
  | "android_chrome"
  | "android_other"
  | "desktop_chrome"
  | "desktop_safari"
  | "desktop_firefox"
  | "desktop_edge"
  | "desktop_other"
  | "non_browser";

export interface HandoffHeaderReader {
  get(name: string): string | null;
}

export interface HandoffTrafficSignals {
  /** Written to user_events.bot_flagged. Only clear non-human hits are true. */
  botFlagged: boolean;
  /** Bounded, non-personal keys merged into the route-hit row metadata. */
  metadata: Record<string, unknown>;
}

const HEADER_VALUE_MAX = 16;
const UA_SAMPLE_MAX = 120;

// Link-preview fetchers act for a person who shared a link; they are not
// crawlers and never a tap. Search crawlers (googlebot etc.) stay known_bot.
const PREVIEW_FETCHERS = new Set([
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "slackbot",
  "telegrambot",
  "discordbot",
  "pinterest",
]);

function shortHeader(headers: HandoffHeaderReader, name: string): string | null {
  const value = headers.get(name);
  if (!value) return null;
  return value.slice(0, HEADER_VALUE_MAX);
}

function classifyUa(userAgent: string): HandoffUaClass {
  if (userAgent.length < 15 || !/mozilla\//i.test(userAgent)) return "non_browser";
  if (/iPad|iPhone|iPod/i.test(userAgent)) {
    return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(userAgent)
      ? "ios_other"
      : "ios_safari";
  }
  if (/Android/i.test(userAgent)) {
    const chrome =
      /Chrome\//i.test(userAgent) && !/SamsungBrowser|EdgA|OPR\//i.test(userAgent);
    return chrome ? "android_chrome" : "android_other";
  }
  if (/Edg\//i.test(userAgent)) return "desktop_edge";
  if (/Firefox\//i.test(userAgent)) return "desktop_firefox";
  if (/Chrome\//i.test(userAgent)) return "desktop_chrome";
  if (/Safari\//i.test(userAgent)) return "desktop_safari";
  return "desktop_other";
}

function isPrefetch(headers: HandoffHeaderReader): boolean {
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""}`;
  return /prefetch|prerender/i.test(purpose);
}

function isMobile(uaClass: HandoffUaClass): boolean {
  return uaClass.startsWith("ios_") || uaClass.startsWith("android_");
}

function resolveTrafficClass(
  headers: HandoffHeaderReader,
  userAgent: string,
  uaClass: HandoffUaClass,
): { trafficClass: HandoffTrafficClass; reason: string } {
  if (isPrefetch(headers)) {
    return { trafficClass: "prefetch", reason: "prefetch_header" };
  }

  const bot = detectBot({ headers });
  if (bot.isBot) {
    const name = bot.botName ?? "";
    const reason = [bot.reason ?? "bot", name].filter(Boolean).join(":");
    const trafficClass: HandoffTrafficClass = PREVIEW_FETCHERS.has(name)
      ? "preview_fetcher"
      : "known_bot";
    return { trafficClass, reason };
  }

  if (headers.get("sec-fetch-user") === "?1") {
    return { trafficClass: "human_candidate", reason: "sec_fetch_user" };
  }
  if (
    isMobile(uaClass) &&
    headers.get("sec-fetch-mode") === "navigate" &&
    userAgent.length > 0
  ) {
    return { trafficClass: "human_candidate", reason: "mobile_navigate" };
  }
  return { trafficClass: "unverified", reason: "none" };
}

function classify(
  headers: HandoffHeaderReader,
  handoffIdInUrl: boolean,
): HandoffTrafficSignals {
  const userAgent = headers.get("user-agent") ?? "";
  const uaClass = classifyUa(userAgent);
  const { trafficClass, reason } = resolveTrafficClass(headers, userAgent, uaClass);

  const metadata: Record<string, unknown> = {
    hit_kind: "route_hit",
    traffic_class: trafficClass,
    traffic_reason: reason,
    ua_class: uaClass,
    handoff_id_source: handoffIdInUrl ? "url" : "minted",
    has_accept_language: Boolean(headers.get("accept-language")),
  };

  for (const name of ["site", "mode", "dest", "user"] as const) {
    const value = shortHeader(headers, `sec-fetch-${name}`);
    if (value) metadata[`sec_fetch_${name}`] = value;
  }

  const country = headers.get("x-vercel-ip-country");
  if (country && /^[A-Za-z]{2}$/.test(country)) {
    metadata.geo_country = country.toUpperCase();
  }

  // Needed to identify the daily crawler from the DB; never stored for
  // traffic that looks like a person.
  if (trafficClass !== "human_candidate" && userAgent) {
    metadata.ua_sample = userAgent.slice(0, UA_SAMPLE_MAX);
  }

  return {
    botFlagged:
      trafficClass === "known_bot" ||
      trafficClass === "preview_fetcher" ||
      trafficClass === "prefetch",
    metadata,
  };
}

/**
 * Classifies a request to the app handoff route for measurement only. It never
 * throws and never changes what the visitor is served: every class still gets
 * the same redirect or page.
 */
export function classifyHandoffRequest(input: {
  headers: HandoffHeaderReader;
  handoffIdInUrl: boolean;
}): HandoffTrafficSignals {
  try {
    return classify(input.headers, input.handoffIdInUrl);
  } catch {
    return {
      botFlagged: false,
      metadata: {
        hit_kind: "route_hit",
        traffic_class: "unverified",
        traffic_reason: "classifier_error",
        handoff_id_source: input.handoffIdInUrl ? "url" : "minted",
      },
    };
  }
}
