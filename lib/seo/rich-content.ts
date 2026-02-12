/**
 * Rich Content Types & Renderer
 *
 * Provides structured content with embedded links for SEO content generators.
 * Instead of returning plain strings, generators can return RichContent arrays
 * that rendering components map to text spans and anchor elements.
 */

import React from "react";

export interface TextSegment {
  type: "text";
  text: string;
}

export interface LinkSegment {
  type: "link";
  text: string;
  href: string;
}

export type ContentSegment = TextSegment | LinkSegment;

/** A sequence of text and link segments that can be rendered as React elements. */
export type RichContent = ContentSegment[];

const LINK_CLASS = "text-ocean-blue hover:underline";

/**
 * Render a RichContent array as React elements.
 *
 * Text segments become plain spans, link segments become anchor tags
 * styled with the standard ocean-blue link color.
 */
export function RichContentRenderer({
  content,
}: {
  content: RichContent;
}): React.ReactElement {
  return React.createElement(
    React.Fragment,
    null,
    ...content.map((segment, i) => {
      if (segment.type === "link") {
        return React.createElement(
          "a",
          { key: i, href: segment.href, className: LINK_CLASS },
          segment.text
        );
      }
      return React.createElement(React.Fragment, { key: i }, segment.text);
    })
  );
}

/**
 * Flatten a RichContent array back to a plain string.
 * Useful for JSON-LD structured data and other contexts that need plain text.
 */
export function richContentToString(content: RichContent): string {
  return content.map((s) => s.text).join("");
}

/**
 * Replace the first occurrence of `name` in `text` with a link segment.
 * Returns the resulting RichContent segments. If `name` is not found,
 * returns a single text segment.
 */
export function linkFirstMention(
  text: string,
  name: string,
  href: string
): RichContent {
  const idx = text.indexOf(name);
  if (idx === -1) {
    return [{ type: "text", text }];
  }

  const segments: RichContent = [];
  if (idx > 0) {
    segments.push({ type: "text", text: text.slice(0, idx) });
  }
  segments.push({ type: "link", text: name, href });
  const after = text.slice(idx + name.length);
  if (after.length > 0) {
    segments.push({ type: "text", text: after });
  }
  return segments;
}

/**
 * Replace the first occurrence of each name in `names` within `text`.
 * Each name is linked only once (first mention). Names already linked
 * are skipped in subsequent passes.
 */
export function linkFirstMentions(
  text: string,
  names: Array<{ name: string; href: string }>
): RichContent {
  if (names.length === 0) {
    return [{ type: "text", text }];
  }

  // Build a single-pass approach: find earliest match, split, recurse on remainder
  let segments: RichContent = [{ type: "text", text }];

  for (const { name, href } of names) {
    const expanded: RichContent = [];
    let linked = false;
    for (const seg of segments) {
      if (seg.type === "link" || linked) {
        expanded.push(seg);
        continue;
      }
      const idx = seg.text.indexOf(name);
      if (idx === -1) {
        expanded.push(seg);
        continue;
      }
      linked = true;
      if (idx > 0) {
        expanded.push({ type: "text", text: seg.text.slice(0, idx) });
      }
      expanded.push({ type: "link", text: name, href });
      const after = seg.text.slice(idx + name.length);
      if (after.length > 0) {
        expanded.push({ type: "text", text: after });
      }
    }
    segments = expanded;
  }

  return segments;
}
