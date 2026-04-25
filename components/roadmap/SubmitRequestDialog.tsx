"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import type { RoadmapCategory } from "@/lib/roadmap/types";

const CATEGORIES: { value: RoadmapCategory; label: string }[] = [
  { value: "forecasts", label: "Forecasts" },
  { value: "logging", label: "Logging" },
  { value: "community", label: "Community" },
  { value: "notifications", label: "Notifications" },
  { value: "subscription", label: "Subscription" },
  { value: "other", label: "Other" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitRequestDialog({ open, onOpenChange }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RoadmapCategory | null>(null);
  const [duplicates, setDuplicates] = useState<Array<{ id: string; title: string }>>([]);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDuplicates = async (q: string) => {
    if (q.length < 2) return setDuplicates([]);
    try {
      const res = await fetch(`/api/roadmap/submissions/duplicate-search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setDuplicates(json.matches ?? []);
    } catch {
      setDuplicates([]);
    }
  };

  const canSubmit =
    title.trim().length >= 1 &&
    title.trim().length <= 60 &&
    description.trim().length >= 1 &&
    description.trim().length <= 500 &&
    !!category &&
    !pending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPending(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/roadmap/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description, category }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Submission failed");
      }
      setTitle("");
      setDescription("");
      setCategory(null);
      setDuplicates([]);
      onOpenChange(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-[var(--font-heading)] text-xl font-bold uppercase tracking-tight text-white">
            Suggest something
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block">
            <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-widest text-[#F78E42]">
              Title
            </span>
            <input
              id="submit-request-title"
              type="text"
              maxLength={60}
              value={title}
              aria-label="Title"
              onChange={(e) => {
                setTitle(e.target.value);
                fetchDuplicates(e.target.value);
              }}
              className="mt-1 w-full rounded-[10px_3px_12px_3px] border border-[#2D357D]/60 bg-[#1E2558]/60 px-3 py-2 text-white placeholder:text-white/30 focus:border-[#F78E42] focus:outline-none"
            />
          </label>

          {duplicates.length > 0 && (
            <div className="rounded-[10px_3px_12px_3px] border border-[#2D357D]/50 bg-[#1E2558]/60 p-3">
              <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-widest text-white/60">
                Is this what you mean?
              </p>
              <ul className="mt-2 space-y-1">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <a
                      href={`/roadmap#item-${d.id}`}
                      className="text-sm text-[#F78E42] hover:underline"
                    >
                      {d.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="block">
            <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-widest text-[#F78E42]">
              Description
            </span>
            <textarea
              maxLength={500}
              rows={4}
              value={description}
              aria-label="Description"
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-[10px_3px_12px_3px] border border-[#2D357D]/60 bg-[#1E2558]/60 px-3 py-2 text-white placeholder:text-white/30 focus:border-[#F78E42] focus:outline-none"
            />
          </label>

          <div>
            <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-widest text-[#F78E42]">
              Category
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`rounded-[10px_3px_12px_3px] border px-3 py-1 font-[var(--font-mono)] text-xs uppercase tracking-wider transition ${
                    category === c.value
                      ? "border-[#F78E42] bg-[#F78E42]/10 text-[#F78E42]"
                      : "border-[#2D357D]/60 text-white/70 hover:border-[#F78E42]/60 hover:text-[#F78E42]"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <p className="text-sm text-[#F87171]">{errorMsg}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-[14px_6px_16px_4px] bg-[#F78E42] px-4 py-3 font-[var(--font-heading)] text-sm font-bold uppercase tracking-wide text-[#252D6B] shadow-[0_3px_0_rgba(0,0,0,0.35)] transition hover:bg-[#ffa760] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send it"}
          </button>

          <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-white/50">
            {"// We read every one. Live within 48h if approved, or a reply if not."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
