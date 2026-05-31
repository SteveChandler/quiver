import { makeSeoId, normalizeSeoPath } from "./dashboard";
import type {
  SeoMetadataAuditInput,
  SeoMetadataAuditIssue,
  SeoPriority,
  SeoRecommendation,
} from "./types";

export interface SeoMetadataPageInput {
  path: string;
  title?: string | null;
  metaDescription?: string | null;
}

const MIN_TITLE_LENGTH = 30;
const MAX_TITLE_LENGTH = 60;
const MIN_META_DESCRIPTION_LENGTH = 120;
const MAX_META_DESCRIPTION_LENGTH = 160;

export function analyzeSeoMetadataAudit(
  pages: SeoMetadataPageInput[],
  generatedAt: string,
): SeoMetadataAuditInput {
  const normalizedPages = pages.map((page) => ({
    path: normalizeSeoPath(page.path),
    title: page.title?.trim() ?? "",
    metaDescription: page.metaDescription?.trim() ?? "",
  }));
  const duplicateTitles = createDuplicateIndex(
    normalizedPages.map((page) => ({ path: page.path, value: page.title })),
  );
  const duplicateDescriptions = createDuplicateIndex(
    normalizedPages.map((page) => ({
      path: page.path,
      value: page.metaDescription,
    })),
  );
  const issues: SeoMetadataAuditIssue[] = normalizedPages.flatMap((page) => {
    const problems = [
      ...validateTitle(page.title),
      ...validateMetaDescription(page.metaDescription),
      ...duplicateProblems({
        duplicateIndex: duplicateTitles,
        path: page.path,
        value: page.title,
        label: "title",
      }),
      ...duplicateProblems({
        duplicateIndex: duplicateDescriptions,
        path: page.path,
        value: page.metaDescription,
        label: "meta description",
      }),
    ];

    if (problems.length === 0) return [];

    return [{
      path: page.path,
      title: page.title,
      titleLength: page.title.length,
      metaDescription: page.metaDescription,
      metaDescriptionLength: page.metaDescription.length,
      priority: priorityForProblems(problems),
      problems,
    }];
  });

  return {
    generatedAt,
    checkedPages: normalizedPages.length,
    issues,
    recommendations: issues.map((issue) =>
      metadataIssueToRecommendation(issue, generatedAt),
    ),
  };
}

function validateTitle(title: string): string[] {
  if (title.length === 0) return ["missing title"];
  if (title.length < MIN_TITLE_LENGTH || title.length > MAX_TITLE_LENGTH) {
    return [
      `title length ${title.length} outside ${MIN_TITLE_LENGTH}-${MAX_TITLE_LENGTH}`,
    ];
  }
  return [];
}

function validateMetaDescription(metaDescription: string): string[] {
  if (metaDescription.length === 0) return ["missing meta description"];
  if (
    metaDescription.length < MIN_META_DESCRIPTION_LENGTH ||
    metaDescription.length > MAX_META_DESCRIPTION_LENGTH
  ) {
    return [
      `meta description length ${metaDescription.length} outside ${MIN_META_DESCRIPTION_LENGTH}-${MAX_META_DESCRIPTION_LENGTH}`,
    ];
  }
  return [];
}

function createDuplicateIndex(
  rows: Array<{ path: string; value: string }>,
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const row of rows) {
    if (row.value.length === 0) continue;
    const key = row.value.toLowerCase();
    index.set(key, [...(index.get(key) ?? []), row.path]);
  }
  for (const [key, paths] of index) {
    if (paths.length < 2) index.delete(key);
  }
  return index;
}

function duplicateProblems({
  duplicateIndex,
  path,
  value,
  label,
}: {
  duplicateIndex: Map<string, string[]>;
  path: string;
  value: string;
  label: "title" | "meta description";
}): string[] {
  if (value.length === 0) return [];
  const duplicatePaths = duplicateIndex.get(value.toLowerCase()) ?? [];
  const otherPath = duplicatePaths.find((candidate) => candidate !== path);
  return otherPath ? [`duplicate ${label} also used by ${otherPath}`] : [];
}

function priorityForProblems(problems: string[]): SeoPriority {
  if (
    problems.some((problem) =>
      problem.startsWith("missing ") || problem.startsWith("duplicate "),
    )
  ) {
    return "high";
  }
  return "medium";
}

function metadataIssueToRecommendation(
  issue: SeoMetadataAuditIssue,
  generatedAt: string,
): SeoRecommendation {
  return {
    id: makeSeoId("metadata-audit", issue.path),
    createdAt: generatedAt,
    source: "metadata-audit",
    priority: issue.priority,
    canonicalPath: issue.path,
    summary: "SEO metadata quality gates failed.",
    evidence: issue.problems,
    status: "open",
  };
}
