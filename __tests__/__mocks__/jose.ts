/**
 * Mock for jose library
 * Provides simplified JWT signing and verification for testing
 */

interface JWTPayload {
  [key: string]: unknown;
  iat?: number;
  exp?: number;
}

// Simple base64url encoding/decoding
function base64UrlEncode(str: string): string {
  const base64 = Buffer.from(str).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(base64 + padding, 'base64').toString();
}

// Simple HMAC-like signature (NOT cryptographically secure, just for testing)
function createSignature(data: string, secret: string): string {
  // Simple hash for testing purposes
  let hash = 0;
  const combined = data + secret;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return base64UrlEncode(hash.toString());
}

class MockSignJWT {
  private payload: JWTPayload;
  private header: { alg: string } = { alg: 'HS256' };

  constructor(payload: JWTPayload) {
    this.payload = { ...payload };
  }

  setProtectedHeader(header: { alg: string }): this {
    this.header = header;
    return this;
  }

  setIssuedAt(): this {
    this.payload.iat = Math.floor(Date.now() / 1000);
    return this;
  }

  setIssuer(issuer: string): this {
    this.payload.iss = issuer;
    return this;
  }

  setSubject(subject: string): this {
    this.payload.sub = subject;
    return this;
  }

  setAudience(audience: string): this {
    this.payload.aud = audience;
    return this;
  }

  setExpirationTime(exp: string): this {
    // Parse expiration like "7d" or "0d"
    const match = exp.match(/^(\d+)([dhms])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      let seconds = 0;
      switch (unit) {
        case 'd':
          seconds = value * 24 * 60 * 60;
          break;
        case 'h':
          seconds = value * 60 * 60;
          break;
        case 'm':
          seconds = value * 60;
          break;
        case 's':
          seconds = value;
          break;
      }
      // If seconds is 0, set exp to 1 second in the past to ensure it's expired
      if (seconds === 0) {
        this.payload.exp = Math.floor(Date.now() / 1000) - 1;
      } else {
        this.payload.exp = Math.floor(Date.now() / 1000) + seconds;
      }
    }
    return this;
  }

  async sign(secretKey: Uint8Array): Promise<string> {
    const secret = new TextDecoder().decode(secretKey);

    const headerEncoded = base64UrlEncode(JSON.stringify(this.header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(this.payload));
    const signature = createSignature(`${headerEncoded}.${payloadEncoded}`, secret);

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }
}

async function jwtVerify(
  token: string,
  secretKey: Uint8Array
): Promise<{ payload: JWTPayload; protectedHeader: { alg: string } }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token');
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const secret = new TextDecoder().decode(secretKey);

  // Verify signature
  const expectedSignature = createSignature(`${headerEncoded}.${payloadEncoded}`, secret);
  if (signatureEncoded !== expectedSignature) {
    throw new Error('signature verification failed');
  }

  // Parse payload
  const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as JWTPayload;
  const header = JSON.parse(base64UrlDecode(headerEncoded)) as { alg: string };

  // Check expiration
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('"exp" claim timestamp check failed');
  }

  return { payload, protectedHeader: header };
}

function createRemoteJWKSet(_url: URL): Uint8Array {
  return new TextEncoder().encode("test-remote-jwk");
}

async function importPKCS8(pem: string): Promise<Uint8Array> {
  return new TextEncoder().encode(pem);
}

function decodeJwt(token: string): JWTPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token");
  }
  return JSON.parse(base64UrlDecode(parts[1])) as JWTPayload;
}

export {
  MockSignJWT as SignJWT,
  createRemoteJWKSet,
  decodeJwt,
  importPKCS8,
  jwtVerify,
};
export type { JWTPayload };
