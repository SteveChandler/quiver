"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  /** The text content to display */
  text: string;
  /** Number of lines to clamp to (default 2) */
  lines?: number;
  className?: string;
}

const LINE_CLAMP: Record<number, string> = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

export function ExpandableText({
  text,
  lines = 2,
  className,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (el) {
      setClamped(el.scrollHeight > el.clientHeight + 1);
    }
  }, [text]);

  return (
    <div className={className}>
      <p
        ref={textRef}
        className={cn(
          expanded ? "line-clamp-none" : LINE_CLAMP[lines] ?? "line-clamp-2"
        )}
      >
        {text}
      </p>
      {(clamped || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs text-ocean-blue/80 hover:text-ocean-blue mt-1 font-medium focus-ring"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
