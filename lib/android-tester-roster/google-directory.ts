import { importPKCS8, SignJWT } from "jose";
import type {
  DirectoryRosterMember,
  DirectoryRosterSnapshot,
} from "./reconciliation";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DIRECTORY_BASE_URL =
  "https://admin.googleapis.com/admin/directory/v1";

export const GOOGLE_DIRECTORY_READONLY_SCOPE =
  "https://www.googleapis.com/auth/admin.directory.group.member.readonly";

export interface GoogleDirectoryConfig {
  groupKey: string;
  delegatedSubject: string;
  clientEmail: string;
  privateKey: string;
}

interface GoogleDirectoryMember {
  id?: unknown;
  email?: unknown;
  type?: unknown;
  status?: unknown;
}

function isConfigured(config: GoogleDirectoryConfig): boolean {
  return Boolean(
    config.groupKey.trim() &&
      config.delegatedSubject.trim() &&
      config.clientEmail.trim() &&
      config.privateKey.includes("BEGIN PRIVATE KEY"),
  );
}

function incompleteSnapshot(): DirectoryRosterSnapshot {
  return { complete: false, members: [] };
}

export async function fetchGoogleGroupMembers(
  config: GoogleDirectoryConfig,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<DirectoryRosterSnapshot> {
  if (!isConfigured(config)) {
    return incompleteSnapshot();
  }

  let signingKey: Awaited<ReturnType<typeof importPKCS8>>;
  try {
    signingKey = await importPKCS8(config.privateKey, "RS256");
  } catch {
    return incompleteSnapshot();
  }

  try {
    const assertion = await new SignJWT({
      scope: GOOGLE_DIRECTORY_READONLY_SCOPE,
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(config.clientEmail)
      .setSubject(config.delegatedSubject)
      .setAudience(GOOGLE_TOKEN_URL)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(signingKey);
    const tokenResponse = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!tokenResponse.ok) {
      return incompleteSnapshot();
    }
    const tokenBody = (await tokenResponse.json()) as {
      access_token?: unknown;
    };
    if (typeof tokenBody.access_token !== "string" || !tokenBody.access_token) {
      return incompleteSnapshot();
    }

    const members: DirectoryRosterMember[] = [];
    let pageToken: string | null = null;
    do {
      const url = new URL(
        `${GOOGLE_DIRECTORY_BASE_URL}/groups/${encodeURIComponent(
          config.groupKey,
        )}/members`,
      );
      url.searchParams.set("maxResults", "200");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${tokenBody.access_token}` },
      });
      if (!response.ok) {
        return incompleteSnapshot();
      }
      const body = (await response.json()) as {
        members?: GoogleDirectoryMember[];
        nextPageToken?: unknown;
      };
      for (const member of body.members ?? []) {
        if (
          member.type === "USER" &&
          member.status === "ACTIVE" &&
          typeof member.id === "string" &&
          typeof member.email === "string"
        ) {
          members.push({
            email: member.email.trim().toLowerCase(),
            externalMemberId: member.id,
          });
        }
      }
      pageToken =
        typeof body.nextPageToken === "string" && body.nextPageToken
          ? body.nextPageToken
          : null;
    } while (pageToken);

    return { complete: true, members };
  } catch {
    return incompleteSnapshot();
  }
}
