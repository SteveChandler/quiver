import { generateKeyPairSync } from "node:crypto";
import { decodeJwt } from "jose";
import {
  GOOGLE_DIRECTORY_READONLY_SCOPE,
  fetchGoogleGroupMembers,
} from "@/lib/android-tester-roster/google-directory";

const PRIVATE_KEY = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
}).privateKey;

function validConfig() {
  return {
    groupKey: "android-testers@example.com",
    delegatedSubject: "directory-reader@example.com",
    clientEmail: "service-account@example-project.iam.gserviceaccount.com",
    privateKey: PRIVATE_KEY,
  };
}

describe("Google Directory Android tester adapter", () => {
  it("fails closed without making a network call when configuration is missing", async () => {
    const fetchImpl = jest.fn();

    const result = await fetchGoogleGroupMembers(
      {
        groupKey: "",
        delegatedSubject: "",
        clientEmail: "",
        privateKey: "",
      },
      fetchImpl,
    );

    expect(result.complete).toBe(false);
    expect(result.members).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed without network when the signing key is invalid", async () => {
    const fetchImpl = jest.fn();

    const result = await fetchGoogleGroupMembers(
      { ...validConfig(), privateKey: "not-a-private-key" },
      fetchImpl,
    );

    expect(result.complete).toBe(false);
    expect(result.members).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses exact delegated readonly claims, a fixed group, 200-row pagination, and direct active USER members only", async () => {
    const requestUrls: string[] = [];
    let signedAssertion: string | null = null;
    const fetchImpl = jest.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      requestUrls.push(url);
      if (url === "https://oauth2.googleapis.com/token") {
        const form = new URLSearchParams(String(init?.body));
        signedAssertion = form.get("assertion");
        return new Response(
          JSON.stringify({ access_token: "directory-token", expires_in: 3600 }),
          { status: 200 },
        );
      }
      if (!url.includes("pageToken=")) {
        return new Response(
          JSON.stringify({
            members: [
              {
                id: "member-1",
                email: "one@example.com",
                type: "USER",
                status: "ACTIVE",
              },
              {
                id: "nested-group",
                email: "nested@example.com",
                type: "GROUP",
                status: "ACTIVE",
              },
              {
                id: "suspended",
                email: "suspended@example.com",
                type: "USER",
                status: "SUSPENDED",
              },
            ],
            nextPageToken: "page-2",
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          members: [
            {
              id: "member-2",
              email: "two@example.com",
              type: "USER",
              status: "ACTIVE",
            },
          ],
        }),
        { status: 200 },
      );
    });

    const result = await fetchGoogleGroupMembers(validConfig(), fetchImpl);

    expect(signedAssertion).not.toBeNull();
    expect(decodeJwt(signedAssertion ?? "")).toEqual(
      expect.objectContaining({
        iss: validConfig().clientEmail,
        sub: validConfig().delegatedSubject,
        aud: "https://oauth2.googleapis.com/token",
        scope: GOOGLE_DIRECTORY_READONLY_SCOPE,
      }),
    );
    expect(requestUrls.filter((url) => url.includes("/members"))).toEqual([
      "https://admin.googleapis.com/admin/directory/v1/groups/android-testers%40example.com/members?maxResults=200",
      "https://admin.googleapis.com/admin/directory/v1/groups/android-testers%40example.com/members?maxResults=200&pageToken=page-2",
    ]);
    expect(result).toEqual({
      complete: true,
      members: [
        { email: "one@example.com", externalMemberId: "member-1" },
        { email: "two@example.com", externalMemberId: "member-2" },
      ],
    });
  });

  it("discards a partial snapshot when any page fails", async () => {
    const fetchImpl = jest.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
        });
      }
      if (!url.includes("pageToken=")) {
        return new Response(
          JSON.stringify({
            members: [
              {
                id: "member-1",
                email: "one@example.com",
                type: "USER",
                status: "ACTIVE",
              },
            ],
            nextPageToken: "page-2",
          }),
          { status: 200 },
        );
      }
      return new Response("unavailable", { status: 503 });
    });

    await expect(
      fetchGoogleGroupMembers(validConfig(), fetchImpl),
    ).resolves.toEqual({
      complete: false,
      members: [],
    });
  });
});
