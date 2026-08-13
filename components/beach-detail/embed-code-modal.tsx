"use client";

import { useState } from "react";
import { Code2, Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EmbedCodeModalProps {
  beachSlug: string | null;
  beachName: string;
}

function EmbedSnippet({
  label,
  code,
}: {
  label: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  return (
    <div>
      <p className="text-xs font-medium text-slate-600 mb-1">{label}</p>
      <div className="relative">
        <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 pr-10 text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap break-all font-mono">
          {code}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 transition-colors focus-ring"
          aria-label={copied ? "Copied" : "Copy embed code"}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-600" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>
      </div>
    </div>
  );
}

export function EmbedCodeButton({ beachSlug, beachName }: EmbedCodeModalProps) {
  if (!beachSlug) return null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  // Escape quotes in beach name to prevent XSS in iframe title attribute
  const escapedBeachName = beachName.replace(/"/g, "&quot;");

  const tideEmbedCode = `<iframe src="${siteUrl}/embed/tides/${beachSlug}" width="100%" height="300" frameborder="0" title="${escapedBeachName} Tide Chart" loading="lazy"></iframe>`;

  const conditionsEmbedCode = `<iframe src="${siteUrl}/embed/conditions/${beachSlug}" width="100%" height="220" frameborder="0" title="${escapedBeachName} Conditions" loading="lazy"></iframe>`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-ocean-blue transition-colors focus-ring"
          title="Get embed code"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Embed</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Embed {beachName} Data</DialogTitle>
          <DialogDescription>
            Copy the code below and paste it into your website&apos;s HTML.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <EmbedSnippet label="Tide Chart" code={tideEmbedCode} />
          <EmbedSnippet
            label="Current Conditions"
            code={conditionsEmbedCode}
          />
        </div>

        <p className="text-[10px] text-slate-400 mt-2">
          Widgets auto-update with live data. Add{" "}
          <code className="bg-slate-100 px-1 rounded">?theme=dark</code> for
          dark mode. Tide chart supports{" "}
          <code className="bg-slate-100 px-1 rounded">?hours=12</code>,{" "}
          <code className="bg-slate-100 px-1 rounded">?hours=18</code>{" "}
          (default), or{" "}
          <code className="bg-slate-100 px-1 rounded">?hours=24</code>.
        </p>
      </DialogContent>
    </Dialog>
  );
}
