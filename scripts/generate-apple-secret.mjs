/**
 * Generate Apple OAuth client secret JWT for Supabase.
 *
 * Usage: node scripts/generate-apple-secret.mjs /path/to/AuthKey_PY23BCF63G.p8
 *
 * Apple requires the client_secret to be a JWT signed with your .p8 key.
 * The JWT is valid for up to 6 months (Apple's max).
 */

import { readFileSync } from "fs";
import { SignJWT, importPKCS8 } from "jose";

const TEAM_ID = "QBA8TA48NG";
const KEY_ID = "PY23BCF63G";
const CLIENT_ID = "app.quiversurf.mobile.web";

const p8Path = process.argv[2];
if (!p8Path) {
  console.error("Usage: node scripts/generate-apple-secret.mjs /path/to/AuthKey.p8");
  process.exit(1);
}

const privateKey = readFileSync(p8Path, "utf8");
const key = await importPKCS8(privateKey, "ES256");

const now = Math.floor(Date.now() / 1000);
const sixMonths = 15777000; // ~6 months in seconds (Apple's max)

const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: KEY_ID })
  .setIssuer(TEAM_ID)
  .setIssuedAt(now)
  .setExpirationTime(now + sixMonths)
  .setAudience("https://appleid.apple.com")
  .setSubject(CLIENT_ID)
  .sign(key);

console.log("\n=== Apple Client Secret JWT ===\n");
console.log(jwt);
console.log("\nExpires:", new Date((now + sixMonths) * 1000).toISOString());
console.log("\nPaste this into Supabase Dashboard → Auth → Providers → Apple → Secret Key\n");
