import { z } from "zod";

import {
  INSTALL_ATTRIBUTION_CAMPAIGNS,
  INSTALL_ATTRIBUTION_PLACEMENTS,
  INSTALL_ATTRIBUTION_SOURCES,
  INSTALL_ATTRIBUTION_SURFACES,
} from "@/lib/install-attribution";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function isCanonicalDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value;
}

export const OperationalEvidenceSchema = z
  .object({
    nativeInstallId: z.string().uuid(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();
const AttributionSchema = z
  .object({
    source: z.enum(INSTALL_ATTRIBUTION_SOURCES),
    surface: z.enum(INSTALL_ATTRIBUTION_SURFACES),
    placement: z.enum(INSTALL_ATTRIBUTION_PLACEMENTS),
    campaign: z.enum(INSTALL_ATTRIBUTION_CAMPAIGNS),
    createdOn: z.string().regex(DATE_PATTERN),
    expiresOn: z.string().regex(DATE_PATTERN),
  })
  .strict()
  .superRefine((value, context) => {
    const created = Date.parse(`${value.createdOn}T00:00:00.000Z`);
    const expires = Date.parse(`${value.expiresOn}T00:00:00.000Z`);
    const today = Date.parse(new Date().toISOString().slice(0, 10));
    if (
      !isCanonicalDate(value.createdOn) ||
      !isCanonicalDate(value.expiresOn) ||
      !Number.isFinite(created) ||
      !Number.isFinite(expires) ||
      expires < created ||
      expires - created > 30 * DAY_MS ||
      created < today - 30 * DAY_MS ||
      created > today + DAY_MS
    ) {
      context.addIssue({
        code: "custom",
        message: "Attribution lifecycle is outside the allowed window",
      });
    }
  });

export const InstallEvidenceSchema = z
  .object({
    nativeInstallId: z.string().uuid(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    attribution: AttributionSchema,
  })
  .strict();
