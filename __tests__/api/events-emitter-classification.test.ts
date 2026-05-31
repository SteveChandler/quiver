/**
 * @jest-environment node
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import {
  EXTERNAL_ANALYTICS_ONLY_EVENTS,
  KNOWN_REJECTED_USER_EVENT_EMITTERS,
  VALID_EVENTS,
} from "@/lib/analytics/event-taxonomy";

const SOURCE_ROOTS = ["actions", "app", "components", "context", "hooks", "lib"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORED_DIRS = new Set([
  "__tests__",
  "__mocks__",
  ".next",
  ".turbo",
  "node_modules",
]);

interface EmitterClassification {
  analyticsOnlyEventNames: string[];
  rejectedUserEventNames: string[];
}

function sourceFiles(root: string): string[] {
  const absoluteRoot = path.join(process.cwd(), root);
  if (!fs.existsSync(absoluteRoot)) return [];

  const files: string[] = [];
  const entries = fs.readdirSync(absoluteRoot, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(absoluteRoot, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        files.push(...sourceFiles(path.relative(process.cwd(), entryPath)));
      }
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function collectStringConstants(
  sourceFile: ts.SourceFile
): Map<string, string> {
  const constants = new Map<string, string>();

  function visit(node: ts.Node): void {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          ts.isStringLiteralLike(declaration.initializer)
        ) {
          constants.set(declaration.name.text, declaration.initializer.text);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return constants;
}

function eventNameFromNode(
  node: ts.Expression,
  constants: Map<string, string>
): string | null {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isIdentifier(node)) return constants.get(node.text) ?? null;
  return null;
}

function propertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return null;
}

function classifyCurrentEmitters(): EmitterClassification {
  const validEvents = new Set<string>(VALID_EVENTS);
  const analyticsOnlyEventNames = new Set<string>();
  const rejectedUserEventNames = new Set<string>();
  const files = SOURCE_ROOTS.flatMap(sourceFiles);

  for (const file of files) {
    const sourceText = fs.readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const constants = collectStringConstants(sourceFile);

    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const calledName = node.expression.text;
        if (calledName === "track" || calledName === "fireToPostHog") {
          const eventName = node.arguments[0]
            ? eventNameFromNode(node.arguments[0], constants)
            : null;
          if (eventName && !validEvents.has(eventName)) {
            analyticsOnlyEventNames.add(eventName);
          }
        }
      }

      if (ts.isPropertyAssignment(node)) {
        const name = propertyNameText(node.name);
        if (name === "eventType") {
          const eventName = eventNameFromNode(node.initializer, constants);
          if (eventName && !validEvents.has(eventName)) {
            rejectedUserEventNames.add(eventName);
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return {
    analyticsOnlyEventNames: [...analyticsOnlyEventNames].sort(),
    rejectedUserEventNames: [...rejectedUserEventNames].sort(),
  };
}

describe("event emitter classification", () => {
  it("classifies current non-internal analytics emitters", () => {
    const { analyticsOnlyEventNames } = classifyCurrentEmitters();

    expect(analyticsOnlyEventNames).toEqual(
      [...EXTERNAL_ANALYTICS_ONLY_EVENTS].sort()
    );
  });

  it("documents current /api/events literals rejected by the internal allowlist", () => {
    const { rejectedUserEventNames } = classifyCurrentEmitters();

    expect(rejectedUserEventNames).toEqual(
      [...KNOWN_REJECTED_USER_EVENT_EMITTERS].sort()
    );
  });

  it("keeps classified analytics-only names out of the internal event allowlist", () => {
    const validEvents = new Set<string>(VALID_EVENTS);

    expect(
      EXTERNAL_ANALYTICS_ONLY_EVENTS.filter((eventName) =>
        validEvents.has(eventName)
      )
    ).toEqual([]);
    expect(
      KNOWN_REJECTED_USER_EVENT_EMITTERS.filter((eventName) =>
        validEvents.has(eventName)
      )
    ).toEqual([]);
  });
});
