import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "seo", "export-dataforseo.ts");
const TSX_LOADER_PATH = require.resolve("tsx");
const execFileAsync = promisify(execFile);

describe("export-dataforseo script", () => {
  it("honors DATAFORSEO_ENABLED=false before making paid API calls", async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    const server = createDataForSeoServer(requests);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const cwd = makeTempWorkspace({
      google: {
        domain: "quiversurf.app",
        device: "mobile",
        depth: 100,
        keywords: ["surf forecast app"],
        locations: [{ name: "United States", code: 2840 }],
      },
      aso: {
        depth: 100,
        keywords: [],
        quiver: { iosAppId: "6759300320", androidAppId: "app.quiversurf.surf" },
      },
      competitors: [],
    });
    const outputPath = path.join(cwd, "DATAFORSEO-EXPORT.json");

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected local test server address");
      }

      await runExporter(cwd, outputPath, {
        DATAFORSEO_API_BASE: `http://127.0.0.1:${address.port}`,
        DATAFORSEO_ENABLED: "false",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        NODE_ENV: "test",
      });

      expect(requests).toHaveLength(0);
      expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
        googleRankings: [],
        asoRankings: [],
        competitorKeywords: [],
        missing: ["DATAFORSEO_DISABLED_BY_CONFIG"],
      });
    } finally {
      await closeServer(server);
    }
  });

  it("sends one Google SERP live task per request", async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    const server = createDataForSeoServer(requests);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected local test server address");
      }
      const cwd = makeTempWorkspace({
        google: {
          domain: "quiversurf.app",
          device: "mobile",
          depth: 100,
          keywords: ["surf forecast app", "best surf app"],
          locations: [{ name: "United States", code: 2840 }],
        },
        aso: {
          depth: 100,
          keywords: [],
          quiver: { iosAppId: "6759300320", androidAppId: "app.quiversurf.surf" },
        },
        competitors: [],
      });
      const outputPath = path.join(cwd, "DATAFORSEO-EXPORT.json");

      await runExporter(cwd, outputPath, {
        DATAFORSEO_API_BASE: `http://127.0.0.1:${address.port}`,
        DATAFORSEO_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        NODE_ENV: "test",
      });

      expect(requests).toHaveLength(2);
      expect(requests.every((item) =>
        item.path === "/v3/serp/google/organic/live/advanced"
      )).toBe(true);
      expect(requests.map((item) => Array.isArray(item.body) ? item.body.length : 0)).toEqual([1, 1]);
    } finally {
      await closeServer(server);
    }
  });
});

function createDataForSeoServer(
  requests: Array<{ path: string; body: unknown }>,
): http.Server {
  return http.createServer(async (request, response) => {
    const body = await readRequestBody(request);
    requests.push({
      path: request.url ?? "",
      body: JSON.parse(body),
    });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [{
        result: [{
          items: [
            {
              type: "organic",
              domain: "www.quiversurf.app",
              url: "https://www.quiversurf.app/",
              title: "Quiver",
              rank_absolute: 2,
            },
          ],
        }],
      }],
    }));
  });
}

function makeTempWorkspace(watchlist: unknown): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-dataforseo-"));
  const seoDocsPath = path.join(cwd, "docs", "seo");
  fs.mkdirSync(seoDocsPath, { recursive: true });
  fs.writeFileSync(
    path.join(seoDocsPath, "dataforseo-watchlist.json"),
    `${JSON.stringify(watchlist, null, 2)}\n`,
  );
  return cwd;
}

async function runExporter(
  cwd: string,
  outputPath: string,
  env: Partial<NodeJS.ProcessEnv>,
): Promise<void> {
  await execFileAsync(
    process.execPath,
    ["--import", TSX_LOADER_PATH, SCRIPT_PATH, "--output", outputPath],
    {
      cwd,
      env: {
        ...process.env,
        DATAFORSEO_APP_POLL_MS: "100",
        DATAFORSEO_APP_POLL_INTERVAL_MS: "10",
        DATAFORSEO_COMPETITOR_KEYWORD_LIMIT: "10",
        ...env,
      },
      timeout: 5000,
    },
  );
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function readRequestBody(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
