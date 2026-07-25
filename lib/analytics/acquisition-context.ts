import { z } from "zod";

const ENTRYPOINT_MAX_LENGTH = 120;
const LANDING_PATH_MAX_LENGTH = 512;
const REFERRER_MAX_LENGTH = 1_024;
const DOMAIN_MAX_LENGTH = 255;
const UTM_VALUE_MAX_LENGTH = 256;
const TIMEZONE_MAX_LENGTH = 64;
const LOCALE_MAX_LENGTH = 32;
const LOCATION_VALUE_MAX_LENGTH = 255;
const APPROVED_REFERRER_PATH_CATEGORIES = new Set(["/search"]);

function optionalNullableTextSchema(maxLength: number) {
  return z.string().max(maxLength).nullable().optional();
}

const signupContextV2Schema = z
  .object({
    schema_version: z.literal(2),
    signup_surface: z.enum([
      "web",
      "native_ios",
      "native_android",
      "unknown",
    ]),
    method: z.enum(["email", "google", "apple", "unknown"]),
    entrypoint: z.string().min(1).max(ENTRYPOINT_MAX_LENGTH),
    landing_path: z.string().max(LANDING_PATH_MAX_LENGTH).optional(),
    referrer: z.string().max(REFERRER_MAX_LENGTH).optional(),
    referrer_domain: z.string().max(DOMAIN_MAX_LENGTH).optional(),
    utm: z
      .object({
        source: optionalNullableTextSchema(UTM_VALUE_MAX_LENGTH),
        medium: optionalNullableTextSchema(UTM_VALUE_MAX_LENGTH),
        campaign: optionalNullableTextSchema(UTM_VALUE_MAX_LENGTH),
        content: optionalNullableTextSchema(UTM_VALUE_MAX_LENGTH),
        term: optionalNullableTextSchema(UTM_VALUE_MAX_LENGTH),
      })
      .strict()
      .optional(),
    source_capture_status: z.enum(["captured", "missing"]),
    tz: optionalNullableTextSchema(TIMEZONE_MAX_LENGTH),
    locale: optionalNullableTextSchema(LOCALE_MAX_LENGTH),
    device: z
      .object({
        kind: z.enum(["mobile", "desktop"]),
      })
      .strict()
      .optional(),
    captured_at: z.string().datetime(),
  })
  .strict();

const webSignupContextSchema = signupContextV2Schema
  .extend({
    signup_surface: z.literal("web"),
  })
  .strict();

const signupMetadataSchema = z
  .object({
    signup_context: webSignupContextSchema,
    location_data: z
      .object({
        source: z.literal("ip"),
        city: optionalNullableTextSchema(LOCATION_VALUE_MAX_LENGTH),
        region: optionalNullableTextSchema(LOCATION_VALUE_MAX_LENGTH),
        country: optionalNullableTextSchema(LOCATION_VALUE_MAX_LENGTH),
        latitude: z.number().nullable().optional(),
        longitude: z.number().nullable().optional(),
      })
      .strict()
      .nullable()
      .optional(),
    legal_consent: z
      .object({
        terms_accepted_at: z.string().datetime(),
        terms_version: z.string().min(1),
        privacy_accepted_at: z.string().datetime(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type SignupContextV2 = z.infer<typeof signupContextV2Schema>;
export type WebSignupContext = z.infer<typeof webSignupContextSchema>;
export type SignupMetadata = z.infer<typeof signupMetadataSchema>;
export type WebSignupMethod = WebSignupContext["method"];

export interface WebSignupAttribution {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
}

export interface WebSignupLocation {
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface BuildWebSignupMetadataInput {
  method: WebSignupMethod;
  entrypoint: string;
  pathname: string;
  referrer: string;
  attribution: WebSignupAttribution;
  timezone: string | null;
  locale: string | null;
  deviceKind: "mobile" | "desktop";
  capturedAt: string;
  legalAcceptedAt: string;
  location: WebSignupLocation | null;
}

function normalizeReferrer(referrer: string): {
  referrer: string;
  referrerDomain?: string;
} {
  if (!referrer) {
    return { referrer: "direct" };
  }

  try {
    const url = new URL(referrer);
    const pathCategory = APPROVED_REFERRER_PATH_CATEGORIES.has(
      url.pathname.toLowerCase(),
    )
      ? url.pathname.toLowerCase()
      : "";
    return {
      referrer: `${url.origin}${pathCategory}`,
      referrerDomain: url.hostname,
    };
  } catch {
    return { referrer: "unknown" };
  }
}

function boundText(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

function boundNullableText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (value == null) return null;
  return boundText(value, maxLength);
}

export function buildWebSignupMetadata(
  input: BuildWebSignupMetadataInput,
): SignupMetadata {
  const normalizedReferrer = normalizeReferrer(input.referrer);

  return signupMetadataSchema.parse({
    signup_context: {
      schema_version: 2,
      signup_surface: "web",
      method: input.method,
      entrypoint:
        boundText(input.entrypoint.trim(), ENTRYPOINT_MAX_LENGTH) || "unknown",
      landing_path: boundText(input.pathname, LANDING_PATH_MAX_LENGTH),
      referrer: boundText(normalizedReferrer.referrer, REFERRER_MAX_LENGTH),
      ...(normalizedReferrer.referrerDomain
        ? {
            referrer_domain: boundText(
              normalizedReferrer.referrerDomain,
              DOMAIN_MAX_LENGTH,
            ),
          }
        : {}),
      utm: {
        source: boundNullableText(
          input.attribution.utm_source,
          UTM_VALUE_MAX_LENGTH,
        ),
        medium: boundNullableText(
          input.attribution.utm_medium,
          UTM_VALUE_MAX_LENGTH,
        ),
        campaign: boundNullableText(
          input.attribution.utm_campaign,
          UTM_VALUE_MAX_LENGTH,
        ),
        content: boundNullableText(
          input.attribution.utm_content,
          UTM_VALUE_MAX_LENGTH,
        ),
        term: boundNullableText(
          input.attribution.utm_term,
          UTM_VALUE_MAX_LENGTH,
        ),
      },
      source_capture_status: "captured",
      tz: boundNullableText(input.timezone, TIMEZONE_MAX_LENGTH),
      locale: boundNullableText(input.locale, LOCALE_MAX_LENGTH),
      device: {
        kind: input.deviceKind,
      },
      captured_at: input.capturedAt,
    },
    location_data: input.location
      ? {
          source: "ip",
          city: boundNullableText(
            input.location.city,
            LOCATION_VALUE_MAX_LENGTH,
          ),
          region: boundNullableText(
            input.location.region,
            LOCATION_VALUE_MAX_LENGTH,
          ),
          country: boundNullableText(
            input.location.country,
            LOCATION_VALUE_MAX_LENGTH,
          ),
          latitude: input.location.latitude,
          longitude: input.location.longitude,
        }
      : null,
    legal_consent: {
      terms_accepted_at: input.legalAcceptedAt,
      terms_version: "2026-01-25",
      privacy_accepted_at: input.legalAcceptedAt,
    },
  });
}

export function parseSignupContextV2(raw: unknown): SignupContextV2 {
  return signupContextV2Schema.parse(raw);
}

export function parseSignupMetadata(raw: unknown): SignupMetadata {
  return signupMetadataSchema.parse(raw);
}
