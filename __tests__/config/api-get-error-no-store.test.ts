/**
 * @jest-environment node
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";
import ts from "typescript";

const API_DIR = join(process.cwd(), "app", "api");
const ROUTE_FILE = /^route\.(ts|tsx|js|jsx|mjs|cjs)$/;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return ROUTE_FILE.test(name) ? [path] : [];
  });
}

/** The route as Next names it: "/api/beaches/[id]" for app/api/beaches/[id]/route.ts. */
function routePathFor(file: string): string {
  const segments = relative(join(process.cwd(), "app"), file).split(sep).slice(0, -1);
  return "/" + segments.filter((s) => !(s.startsWith("(") && s.endsWith(")"))).join("/");
}

function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function wrapsWithRoutePath(expr: ts.Expression | undefined, routePath: string): boolean {
  if (!expr || !ts.isCallExpression(expr)) return false;
  if (!ts.isIdentifier(expr.expression) || expr.expression.text !== "withErrorNoStore") return false;
  const [, pathArg] = expr.arguments;
  return pathArg !== undefined && ts.isStringLiteral(pathArg) && pathArg.text === routePath;
}

/**
 * Problems with how a route file exports GET. An unwrapped GET can send a
 * 401, 404 or 500 that the /api/* blanket in next.config.mjs lets browsers and
 * iOS keep for 60 s; see lib/middleware/api-wrappers/error-cache-wrapper.ts.
 */
export function getExportProblems(source: string, routePath: string, fileName = "route.ts"): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const problems: string[] = [];
  const topLevelConsts = new Map<string, ts.Expression | undefined>();
  const getInitializers: Array<ts.Expression | undefined> = [];

  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt)) {
      if (!stmt.exportClause) {
        problems.push("export * can re-export an unwrapped GET");
      } else if (ts.isNamedExports(stmt.exportClause) && stmt.exportClause.elements.some((e) => e.name.text === "GET")) {
        problems.push("GET re-exported by name");
      }
      continue;
    }
    if (ts.isFunctionDeclaration(stmt) && isExported(stmt) && stmt.name?.text === "GET") {
      problems.push("GET exported as a function declaration");
      continue;
    }
    if (!ts.isVariableStatement(stmt)) continue;
    const isConst = (stmt.declarationList.flags & ts.NodeFlags.Const) !== 0;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name)) {
        if (isExported(stmt) && decl.name.getText(sf).match(/\bGET\b/)) problems.push("GET exported by destructuring");
        continue;
      }
      if (isConst) topLevelConsts.set(decl.name.text, decl.initializer);
      if (!isExported(stmt) || decl.name.text !== "GET") continue;
      if (!isConst) problems.push("GET exported with let or var");
      getInitializers.push(decl.initializer);
    }
  }

  for (const init of getInitializers) {
    if (wrapsWithRoutePath(init, routePath)) continue;
    if (init && ts.isIdentifier(init) && wrapsWithRoutePath(topLevelConsts.get(init.text), routePath)) continue;
    problems.push(`GET is not withErrorNoStore(handler, "${routePath}")`);
  }
  return problems;
}

describe("getExportProblems", () => {
  const PATH = "/api/things/[id]";
  const ok = [
    `export const GET = withErrorNoStore(handleGet, "${PATH}");`,
    `export const GET: RouteHandler = withErrorNoStore(handleGet, "${PATH}");`,
    `const notFound = withErrorNoStore(async () => x, "${PATH}");\nexport const GET = notFound`,
    `export const POST = withAuth(handler); // no GET at all`,
    `// export { GET } from "./other"\nexport const GET = withErrorNoStore(h, "${PATH}");`,
  ];
  const bad: Array<[string, string]> = [
    ["typed but unwrapped", `export const GET: RouteHandler = withAuth(h);`],
    ["function declaration", `export async function GET() { return new Response(); }`],
    ["destructuring", `export const { GET } = handlers;`],
    ["let", `export let GET = withErrorNoStore(h, "${PATH}");`],
    ["var", `export var GET = withErrorNoStore(h, "${PATH}");`],
    ["export star", `export * from "./other";`],
    ["named re-export", `const handler = withAuth(h);\nexport { handler as GET };`],
    ["alias without semicolon to unwrapped", `const h2 = withAuth(h)\nexport const GET = h2`],
    ["wrong route path", `export const GET = withErrorNoStore(h, "/api/other");`],
    ["missing route path", `export const GET = withErrorNoStore(h);`],
  ];

  it.each(ok)("accepts %s", (source) => {
    expect(getExportProblems(source, PATH)).toEqual([]);
  });

  it.each(bad)("rejects %s", (_name, source) => {
    expect(getExportProblems(source, PATH).length).toBeGreaterThan(0);
  });
});

describe("every API GET keeps its errors out of caches", () => {
  const files = routeFiles(API_DIR);

  it("finds the API routes", () => {
    expect(files.length).toBeGreaterThan(150);
  });

  // The unknown-path 404 sets its own browser no-store and a CDN cache that the
  // wrapper would strip; see app/api/[...unknown]/route.ts and its test.
  const EXEMPT = new Set([join("app", "api", "[...unknown]", "route.ts")]);

  it.each(files.filter((f) => !EXEMPT.has(relative(process.cwd(), f))).map((f) => [relative(process.cwd(), f), f]))(
    "%s",
    (_name, file) => {
      expect(getExportProblems(readFileSync(file, "utf8"), routePathFor(file), file)).toEqual([]);
    }
  );
});
