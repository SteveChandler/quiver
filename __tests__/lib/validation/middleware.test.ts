jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";
import { parseAndValidateJson } from "@/lib/validation/middleware";

function makeJsonRequest(body: string, contentType?: string): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body,
    headers: contentType ? { "content-type": contentType } : undefined,
  });
}

function requireValidationError(
  result: Awaited<ReturnType<typeof parseAndValidateJson>>
): Response {
  if (!("error" in result)) {
    throw new Error("Expected parseAndValidateJson to return a validation error");
  }

  return result.error;
}

describe("parseAndValidateJson", () => {
  it("returns parsed data for a valid application/json request", async () => {
    const request = makeJsonRequest(
      JSON.stringify({ message: "clean" }),
      "application/json"
    );

    const result = await parseAndValidateJson<{ message: string }>(request);

    expect(result).toEqual({ data: { message: "clean" } });
  });

  it("returns a 400 response for a wrong content type", async () => {
    const request = makeJsonRequest(JSON.stringify({ message: "clean" }), "text/plain");

    const result = await parseAndValidateJson(request);
    const error = requireValidationError(result);

    expect(error.status).toBe(400);
    await expect(error.json()).resolves.toMatchObject({
      success: false,
      error: "Invalid Content-Type. Expected application/json",
    });
  });

  it("returns a 400 response when content type is missing", async () => {
    const request = makeJsonRequest(JSON.stringify({ message: "clean" }));

    const result = await parseAndValidateJson(request);
    const error = requireValidationError(result);

    expect(error.status).toBe(400);
    await expect(error.json()).resolves.toMatchObject({
      success: false,
      error: "Invalid Content-Type. Expected application/json",
    });
  });

  it("returns a 400 response for invalid JSON", async () => {
    const request = makeJsonRequest("{", "application/json");

    const result = await parseAndValidateJson(request);
    const error = requireValidationError(result);

    expect(error.status).toBe(400);
    await expect(error.json()).resolves.toMatchObject({
      success: false,
      error: "Invalid JSON in request body",
    });
  });
});

describe("validation middleware source guard", () => {
  it("uses the API wrapper barrel for validation errors", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/validation/middleware.ts"),
      "utf8"
    );

    expect(source).not.toContain("@/lib/api-utils");
    expect(source).toContain("@/lib/middleware/api-wrappers");
  });
});
