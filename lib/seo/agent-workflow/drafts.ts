import type { SeoDraftRequest } from "./types";

export function renderSeoDraftArtifact(request: SeoDraftRequest): string {
  const competingUrls = request.competingInternalUrls.length > 0
    ? request.competingInternalUrls.map((url) => `  - ${url}`).join("\n")
    : "  - none found";
  const citations = request.citations.length > 0
    ? request.citations.map((citation) => `  - ${citation.label}: ${citation.url}`).join("\n")
    : "  - required before approval";
  const internalLinks = request.requiredInternalLinks.length > 0
    ? request.requiredInternalLinks.map((url) => `  - ${url}`).join("\n")
    : "  - add at least 3 Quiver internal links before approval";

  return `---
slug: ${request.slug}
title: ${JSON.stringify(request.title)}
pageType: ${request.pageType}
targetKeyword: ${JSON.stringify(request.targetKeyword)}
status: review-queue
publishing: manual-approval-required
---

# ${request.title}

> TL;DR: Replace this with a direct answer in 2-3 sentences before approval.

## Review Metadata

Target keyword: ${request.targetKeyword}

Competing internal URLs:
${competingUrls}

Trusted citations:
${citations}

Required internal links:
${internalLinks}

## Draft Outline

## What should surfers know first?

Direct answer goes here.

## How do the forecast signals change the call?

Use Quiver-specific surf context and cite factual claims.

## What should you check next?

Link to forecast, tide, water-temp, best-time, guides, and relevant beach/city pages.

## FAQ

### Question-style H2/H3 prompt?

Concise answer.

## Approval Checklist

- [ ] No competing internal URL already owns the same target keyword.
- [ ] Factual claims cite NOAA, NDBC, CDIP, NWS, .gov, or .edu where applicable.
- [ ] Includes a TL;DR and question-style headings.
- [ ] Includes required Quiver internal links.
- [ ] Reviewed manually before any repo/runtime content change.
`;
}
