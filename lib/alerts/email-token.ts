import crypto from "crypto";

function getSecret(): string {
  const secret = process.env.ALERT_EMAIL_SECRET || process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("ALERT_EMAIL_SECRET or CRON_SECRET must be set in production");
  }
  return secret || "fallback-dev-secret";
}

export function generateDisableToken(ruleId: string): string {
  return crypto.createHmac("sha256", getSecret()).update(ruleId).digest("hex").slice(0, 32);
}

export function verifyDisableToken(ruleId: string, token: string): boolean {
  const expected = generateDisableToken(ruleId);
  if (expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
