import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function getRawButtonOpenings(sourcePath: string): string[] {
  const sourceText = readSource(sourcePath);
  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const openings: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      if (opening.tagName.getText(sourceFile) === "button") {
        openings.push(opening.getText(sourceFile));
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return openings;
}

describe("shared raw button focus ring", () => {
  it("defines a focus-visible utility with paper and twilight contrast support", () => {
    const styles = readSource("app/globals.css");

    expect(styles).toContain(".focus-ring:focus-visible");
    expect(styles).toContain("var(--stamp-blue, #0B3A75)");
    expect(styles).toContain("var(--paper, #F4EBD8)");
  });

  it("applies the utility to representative previously unstyled buttons", () => {
    const representativeSources = [
      "components/session/post-session-share.tsx",
      "components/onboarding/steps/experience-level-step.tsx",
      "components/seo/faq-section.tsx",
      "components/ui/sticky-signup-bar.tsx",
    ];

    for (const sourcePath of representativeSources) {
      const hasFocusRing = getRawButtonOpenings(sourcePath).some((opening) =>
        opening.includes("focus-ring"),
      );
      expect(hasFocusRing).toBe(true);
    }
  });
});
