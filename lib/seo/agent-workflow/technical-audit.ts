import {
  makeSeoId,
  normalizeSeoPath,
} from "./dashboard";
import type {
  SeoRecommendation,
  TechnicalAuditInput,
  TechnicalAuditPageInput,
} from "./types";

export function analyzeTechnicalAudit(
  input: TechnicalAuditInput,
  now: string,
): SeoRecommendation[] {
  const recommendations: SeoRecommendation[] = [
    ...analyzeRobots(input.robotsTxt, now),
    ...analyzeSitemap(input.sitemapXml, now),
    ...input.pages.flatMap((page) => analyzePage(page, now)),
  ];

  return recommendations.sort((a, b) => a.id.localeCompare(b.id));
}

export function extractSitemapPaths(xml: string): string[] {
  const matches = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gim)];
  return matches.map((match) => normalizeSeoPath(decodeXml(match[1] ?? "")));
}

function analyzeRobots(robotsTxt: string, now: string): SeoRecommendation[] {
  const recommendations: SeoRecommendation[] = [];
  const blocksNext = /^disallow:\s*\/_next\/?\s*$/gim.test(robotsTxt);
  const allowsNextStatic = /^allow:\s*\/_next\/static\/?\s*$/gim.test(robotsTxt);

  if (blocksNext && !allowsNextStatic) {
    recommendations.push({
      id: "technical-audit-robots-next-static",
      createdAt: now,
      source: "technical-audit",
      priority: "critical",
      canonicalPath: "/robots.txt",
      summary: "robots.txt blocks Next static assets without allowing /_next/static/.",
      evidence: ["Render-critical assets under /_next/static/ may be blocked from crawlers."],
      status: "open",
    });
  }

  return recommendations;
}

function analyzeSitemap(sitemapXml: string, now: string): SeoRecommendation[] {
  const paths = extractSitemapPaths(sitemapXml);
  if (paths.length === 0) {
    return [{
      id: "technical-audit-empty-sitemap",
      createdAt: now,
      source: "technical-audit",
      priority: "critical",
      canonicalPath: "/sitemap.xml",
      summary: "Sitemap has no parseable URLs.",
      evidence: ["No <loc> entries found."],
      status: "open",
    }];
  }

  const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index);
  if (duplicates.length === 0) return [];

  return [{
    id: "technical-audit-duplicate-sitemap-urls",
    createdAt: now,
    source: "technical-audit",
    priority: "medium",
    canonicalPath: "/sitemap.xml",
    summary: "Sitemap contains duplicate canonical paths.",
    evidence: [...new Set(duplicates)].slice(0, 10),
    status: "open",
  }];
}

function analyzePage(
  page: TechnicalAuditPageInput,
  now: string,
): SeoRecommendation[] {
  const canonicalPath = normalizeSeoPath(page.url);
  const recommendations: SeoRecommendation[] = [];
  const title = extractTagContent(page.html, "title");
  const description = extractMetaDescription(page.html);
  const canonical = extractCanonical(page.html);
  const brokenLinks = (page.outgoingLinks ?? [])
    .filter((link) => typeof link.status === "number" && link.status >= 400);

  if (page.status >= 500) {
    recommendations.push({
      id: makeSeoId("technical-status", canonicalPath),
      createdAt: now,
      source: "technical-audit",
      priority: "critical",
      canonicalPath,
      summary: "Indexable page returned a server error.",
      evidence: [`status=${page.status}`],
      status: "open",
    });
  }

  if (!canonical) {
    recommendations.push({
      id: makeSeoId("technical-canonical-missing", canonicalPath),
      createdAt: now,
      source: "technical-audit",
      priority: "high",
      canonicalPath,
      summary: "Page is missing a canonical link.",
      evidence: ["No rel=\"canonical\" link found."],
      status: "open",
    });
  } else if (normalizeSeoPath(canonical) !== canonicalPath) {
    recommendations.push({
      id: makeSeoId("technical-canonical-mismatch", canonicalPath),
      createdAt: now,
      source: "technical-audit",
      priority: "medium",
      canonicalPath,
      summary: "Page canonical points to a different path.",
      evidence: [`canonical=${canonical}`],
      status: "open",
    });
  }

  if (!title || title.length > 65) {
    recommendations.push({
      id: makeSeoId("technical-title", canonicalPath),
      createdAt: now,
      source: "technical-audit",
      priority: "medium",
      canonicalPath,
      summary: title ? "Title tag is longer than 65 characters." : "Title tag is missing.",
      evidence: title ? [`length=${title.length}`, title] : ["missing title"],
      status: "open",
    });
  }

  if (!description || description.length > 170) {
    recommendations.push({
      id: makeSeoId("technical-description", canonicalPath),
      createdAt: now,
      source: "technical-audit",
      priority: "medium",
      canonicalPath,
      summary: description
        ? "Meta description is longer than 170 characters."
        : "Meta description is missing.",
      evidence: description ? [`length=${description.length}`, description] : ["missing description"],
      status: "open",
    });
  }

  if (brokenLinks.length > 0) {
    recommendations.push({
      id: makeSeoId("technical-broken-links", canonicalPath),
      createdAt: now,
      source: "technical-audit",
      priority: "high",
      canonicalPath,
      summary: "Page contains broken outgoing links.",
      evidence: brokenLinks.slice(0, 10).map((link) => `${link.href} status=${link.status}`),
      status: "open",
    });
  }

  return recommendations;
}

function extractCanonical(html: string): string | null {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  return match?.[1] ?? null;
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

function extractTagContent(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "is"));
  return match?.[1] ? decodeHtml(match[1].replace(/\s+/g, " ").trim()) : null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function decodeHtml(value: string): string {
  return decodeXml(value)
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
