#!/usr/bin/env tsx

import { createHash } from "node:crypto";

import { z } from "zod";

export type Command =
  | "list-active"
  | "activate"
  | "extend"
  | "replace"
  | "cancel";

const COMMANDS = new Set<Command>([
  "list-active",
  "activate",
  "extend",
  "replace",
  "cancel",
]);
const MUTATIONS = new Set<Command>(["activate", "extend", "replace", "cancel"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 15_000;
const UUID_SCHEMA = z.string().uuid();
const ISO_INSTANT_SCHEMA = z.string().datetime({ offset: true });
const PROVENANCE_SCHEMA = z.discriminatedUnion("triggerType", [
  z
    .object({
      triggerType: z.literal("manual_operator"),
      authorizingActor: z.literal("admin_api"),
    })
    .strict(),
  z
    .object({
      triggerType: z.literal("automatic_official"),
      authorizingActor: z.literal("official_automation"),
    })
    .strict(),
]);
const ADMIN_HOLD_SCHEMA = z
  .object({
    holdId: UUID_SCHEMA,
    version: z.number().int().positive(),
    transition: z.enum([
      "activation",
      "extension",
      "replacement",
      "cancellation",
    ]),
    status: z.enum(["active", "cancelled"]),
    lifecycle: z.enum(["effective", "scheduled"]),
    regionKeys: z.array(z.string().min(1).max(64)).max(64),
    scopeBeachIds: z.array(UUID_SCHEMA).min(1).max(2000),
    scopeExposureClasses: z
      .array(
        z.enum([
          "fully_exposed",
          "partially_protected",
          "protected",
          "unknown",
        ]),
      )
      .max(4),
    protectedAlternativeBeachIds: z.array(UUID_SCHEMA).max(2000),
    validFrom: ISO_INSTANT_SCHEMA,
    validUntil: ISO_INSTANT_SCHEMA,
    affectedCohorts: z
      .array(
        z.enum(["beginner", "intermediate", "advanced", "expert", "unknown"]),
      )
      .min(1)
      .max(5),
    action: z.enum(["suppress_positive", "protected_alternatives_only"]),
    provenance: PROVENANCE_SCHEMA,
    reasonCode: z.enum([
      "major_swell_manual_safety",
      "official_high_rip_current",
      "scope_correction",
      "event_expired",
      "operator_cancelled",
      "policy_rollback",
    ]),
    effectiveAt: ISO_INSTANT_SCHEMA,
    expiresAt: ISO_INSTANT_SCHEMA,
    createdAt: ISO_INSTANT_SCHEMA,
  })
  .strict();
const MUTATION_RESPONSE_SCHEMA = z
  .object({
    success: z.literal(true),
    data: z
      .object({
        outcome: z.literal("accepted"),
        hold: ADMIN_HOLD_SCHEMA,
      })
      .strict(),
    requestId: UUID_SCHEMA,
  })
  .strict();
const LIST_RESPONSE_SCHEMA = z
  .object({
    success: z.literal(true),
    data: z
      .object({
        holds: z.array(ADMIN_HOLD_SCHEMA).max(5000),
      })
      .strict(),
    requestId: UUID_SCHEMA,
  })
  .strict();
const EXPECTED_TRANSITIONS = {
  activate: "activation",
  extend: "extension",
  replace: "replacement",
  cancel: "cancellation",
} as const;
const NORMALIZED_UUID_SCHEMA = UUID_SCHEMA.transform((value) =>
  value.toLowerCase(),
);
const POLICY_BODY_SCHEMA = z
  .object({
    regionKeys: z.array(z.string()).default([]),
    scopeBeachIds: z.array(NORMALIZED_UUID_SCHEMA).default([]),
    scopeExposureClasses: z.array(z.string()).default([]),
    protectedAlternativeBeachIds: z.array(NORMALIZED_UUID_SCHEMA).default([]),
    validFrom: ISO_INSTANT_SCHEMA,
    validUntil: ISO_INSTANT_SCHEMA,
    affectedCohorts: z.array(z.string()),
    action: z.enum(["suppress_positive", "protected_alternatives_only"]),
    reasonCode: z.enum([
      "major_swell_manual_safety",
      "scope_correction",
      "policy_rollback",
    ]),
  })
  .passthrough();
const EXTEND_BODY_SCHEMA = z
  .object({
    holdId: NORMALIZED_UUID_SCHEMA,
    newValidUntil: ISO_INSTANT_SCHEMA,
    reasonCode: z.literal("major_swell_manual_safety"),
  })
  .passthrough();
const CANCEL_BODY_SCHEMA = z
  .object({
    holdId: NORMALIZED_UUID_SCHEMA,
    reasonCode: z.enum([
      "event_expired",
      "operator_cancelled",
      "policy_rollback",
    ]),
  })
  .passthrough();

export interface CliOptions {
  command: Command;
  body: Record<string, unknown> | null;
  idempotencyKey: string | null;
  retries: number;
}

export interface RecommendationHoldCliDependencies {
  adminCookie: string;
  baseUrl: string;
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  randomUUID: () => string;
  log: (message: string) => void;
  attemptTimeoutMs?: number;
}

class NonRetryableRequestError extends Error {}

function invalidResponse(command: Command): NonRetryableRequestError {
  return new NonRetryableRequestError(
    `Admin API returned an invalid ${command === "list-active" ? "list" : "mutation"} response`,
  );
}

function normalizeAdminBaseUrl(value: string): string {
  const error =
    "QUIVER_ADMIN_BASE_URL must be an HTTPS origin or loopback HTTP URL";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(error);
  }
  const isLoopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
    url.hostname.toLowerCase(),
  );
  if (
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    (url.pathname !== "" && url.pathname !== "/") ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback))
  ) {
    throw new Error(error);
  }
  return url.origin;
}

function assertTrustedResponse(response: Response, requestUrl: string): void {
  if (response.redirected || response.type === "opaqueredirect") {
    throw new NonRetryableRequestError(
      "Received an untrusted Admin API response",
    );
  }

  let responseUrl: URL;
  const expectedUrl = new URL(requestUrl);
  try {
    responseUrl = new URL(response.url);
  } catch {
    throw new NonRetryableRequestError(
      "Received an untrusted Admin API response",
    );
  }
  if (
    responseUrl.origin !== expectedUrl.origin ||
    responseUrl.pathname !== expectedUrl.pathname ||
    responseUrl.search !== expectedUrl.search
  ) {
    throw new NonRetryableRequestError(
      "Received an untrusted Admin API response",
    );
  }
}

function deterministicActivationHoldId(idempotencyKey: string): string {
  const input = `quiver:regional-hold:manual:activation:${idempotencyKey.toLowerCase()}`;
  const bytes = createHash("sha256")
    .update(input, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

function canonicalInstant(value: string): string {
  return new Date(value).toISOString();
}

function matchesCommandSemantics(
  options: CliOptions,
  hold: z.infer<typeof ADMIN_HOLD_SCHEMA>,
  idempotencyKey: string | null,
): boolean {
  if (options.command === "cancel") {
    const expected = CANCEL_BODY_SCHEMA.safeParse(options.body);
    return (
      expected.success &&
      hold.holdId.toLowerCase() === expected.data.holdId &&
      hold.reasonCode === expected.data.reasonCode &&
      hold.version > 1
    );
  }

  if (options.command === "extend") {
    const expected = EXTEND_BODY_SCHEMA.safeParse(options.body);
    return (
      expected.success &&
      hold.holdId.toLowerCase() === expected.data.holdId &&
      canonicalInstant(hold.validUntil) ===
        canonicalInstant(expected.data.newValidUntil) &&
      hold.reasonCode === expected.data.reasonCode &&
      hold.version > 1
    );
  }

  const expected = POLICY_BODY_SCHEMA.safeParse(options.body);
  if (!expected.success) return false;
  const requestedHoldId = NORMALIZED_UUID_SCHEMA.safeParse(
    options.body?.holdId,
  );
  const expectedHoldId =
    options.command === "activate"
      ? idempotencyKey && UUID_PATTERN.test(idempotencyKey)
        ? deterministicActivationHoldId(idempotencyKey)
        : null
      : requestedHoldId.success
        ? requestedHoldId.data
        : null;
  if (!expectedHoldId || hold.holdId.toLowerCase() !== expectedHoldId) {
    return false;
  }
  if (
    options.command === "activate" &&
    expected.data.reasonCode !== "major_swell_manual_safety"
  ) {
    return false;
  }

  const actualScope = hold.scopeBeachIds.map((value) => value.toLowerCase());
  const scopeMatches =
    expected.data.regionKeys.length === 0
      ? sameValues(actualScope, expected.data.scopeBeachIds)
      : expected.data.scopeBeachIds.every((value) =>
          actualScope.includes(value),
        );
  return (
    (options.command !== "activate" || hold.version === 1) &&
    (options.command !== "replace" || hold.version > 1) &&
    sameValues(hold.regionKeys, expected.data.regionKeys) &&
    scopeMatches &&
    sameValues(hold.scopeExposureClasses, expected.data.scopeExposureClasses) &&
    sameValues(
      hold.protectedAlternativeBeachIds.map((value) => value.toLowerCase()),
      expected.data.protectedAlternativeBeachIds,
    ) &&
    canonicalInstant(hold.validFrom) ===
      canonicalInstant(expected.data.validFrom) &&
    canonicalInstant(hold.validUntil) ===
      canonicalInstant(expected.data.validUntil) &&
    sameValues(hold.affectedCohorts, expected.data.affectedCohorts) &&
    hold.action === expected.data.action &&
    hold.reasonCode === expected.data.reasonCode
  );
}

function validateSuccessfulResponse(
  responseText: string,
  options: CliOptions,
  traceId: string,
  idempotencyKey: string | null,
):
  | z.infer<typeof MUTATION_RESPONSE_SCHEMA>
  | z.infer<typeof LIST_RESPONSE_SCHEMA> {
  let body: unknown;
  try {
    body = JSON.parse(responseText) as unknown;
  } catch {
    throw invalidResponse(options.command);
  }

  if (options.command === "list-active") {
    const parsed = LIST_RESPONSE_SCHEMA.safeParse(body);
    if (
      !parsed.success ||
      parsed.data.requestId.toLowerCase() !== traceId.toLowerCase()
    ) {
      throw invalidResponse(options.command);
    }
    return parsed.data;
  }

  const parsed = MUTATION_RESPONSE_SCHEMA.safeParse(body);
  if (!parsed.success) throw invalidResponse(options.command);
  const expectedTransition = EXPECTED_TRANSITIONS[options.command];
  const expectedStatus =
    expectedTransition === "cancellation" ? "cancelled" : "active";
  if (
    parsed.data.requestId.toLowerCase() !== traceId.toLowerCase() ||
    parsed.data.data.hold.transition !== expectedTransition ||
    parsed.data.data.hold.status !== expectedStatus ||
    !matchesCommandSemantics(options, parsed.data.data.hold, idempotencyKey)
  ) {
    throw invalidResponse(options.command);
  }
  return parsed.data;
}

function flagValue(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] ?? null;
  const prefix = `${name}=`;
  return (
    args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null
  );
}

function parseOptions(argv: string[]): CliOptions {
  const command = argv[0] as Command | undefined;
  if (!command || !COMMANDS.has(command)) {
    throw new Error(
      "Usage: recommendation-hold.ts <list-active|activate|extend|replace|cancel> [--body-json JSON] [--idempotency-key UUID] [--retries N]",
    );
  }

  const bodyJson = flagValue(argv, "--body-json");
  let body: Record<string, unknown> | null = null;
  if (bodyJson !== null) {
    const parsed: unknown = JSON.parse(bodyJson);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("--body-json must contain a JSON object");
    }
    body = parsed as Record<string, unknown>;
  }
  if (MUTATIONS.has(command) && body === null) {
    throw new Error(`${command} requires --body-json`);
  }

  const idempotencyKey = flagValue(argv, "--idempotency-key");
  if (idempotencyKey !== null && !UUID_PATTERN.test(idempotencyKey)) {
    throw new Error("--idempotency-key must be a UUID");
  }
  const retriesRaw = flagValue(argv, "--retries") ?? "2";
  const retries = Number(retriesRaw);
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) {
    throw new Error("--retries must be an integer from 0 through 5");
  }
  return { command, body, idempotencyKey, retries };
}

export async function callAdminApi(
  options: CliOptions,
  injected?: RecommendationHoldCliDependencies,
): Promise<void> {
  const adminCookie = injected?.adminCookie ?? process.env.QUIVER_ADMIN_COOKIE;
  if (!adminCookie) throw new Error("QUIVER_ADMIN_COOKIE is required");
  const baseUrl = normalizeAdminBaseUrl(
    injected?.baseUrl ??
      process.env.QUIVER_ADMIN_BASE_URL ??
      "http://localhost:3000",
  );
  const fetchImpl = injected?.fetchImpl ?? fetch;
  const randomUUID = injected?.randomUUID ?? (() => crypto.randomUUID());
  const log = injected?.log ?? console.log;
  const attemptTimeoutMs =
    injected?.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
  const url = `${baseUrl}/api/admin/recommendation-holds`;
  const isMutation = MUTATIONS.has(options.command);
  const idempotencyKey = isMutation
    ? (options.idempotencyKey ?? randomUUID())
    : null;

  if (idempotencyKey) log(`Idempotency-Key: ${idempotencyKey}`);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    const traceId = randomUUID();
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(new Error("Admin API attempt timed out")),
      attemptTimeoutMs,
    );
    try {
      const response = await fetchImpl(url, {
        method: isMutation ? "POST" : "GET",
        redirect: "manual",
        signal: abortController.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Cookie: adminCookie,
          "X-Request-ID": traceId,
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        ...(isMutation
          ? {
              body: JSON.stringify({
                ...options.body,
                operation: options.command,
              }),
            }
          : {}),
      });
      assertTrustedResponse(response, url);
      if (!response.ok) {
        if (response.status < 500) {
          throw new NonRetryableRequestError(
            `Admin API returned ${response.status}`,
          );
        }
        if (attempt === options.retries) {
          throw new Error(`Admin API returned ${response.status}`);
        }
        lastError = new Error(`Admin API returned ${response.status}`);
        continue;
      }
      const contentType = response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (contentType !== "application/json") {
        throw invalidResponse(options.command);
      }
      const validated = validateSuccessfulResponse(
        await response.text(),
        options,
        traceId,
        idempotencyKey,
      );
      log(JSON.stringify(validated));
      return;
    } catch (error) {
      if (error instanceof NonRetryableRequestError) throw error;
      lastError =
        error instanceof Error ? error : new Error("Admin API request failed");
      if (attempt === options.retries) throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error("Admin API request failed");
}

async function main(argv: string[]): Promise<void> {
  await callAdminApi(parseOptions(argv));
}

if (require.main === module) {
  void main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Admin API request failed",
    );
    process.exitCode = 1;
  });
}
