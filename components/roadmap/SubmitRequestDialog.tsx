"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const fetchDuplicates = async (q: string): Promise<void> => {
    if (q.length < 2) {
      if (duplicates.length > 0) {
        setDuplicates([]);
      }
      return;
    }
    try {
      const res = await fetch(`/api/roadmap/submissions/duplicate-search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setDuplicates(json.matches ?? []);
    } catch {
      if (duplicates.length > 0) {
        setDuplicates([]);
      }
    }
  };

  const canSubmit =
    title.trim().length >= 1 &&
    title.trim().length <= 60 &&
    description.trim().length >= 1 &&
    description.trim().length <= 500 &&
    !!category &&
    !pending;

  const handleSubmit = async (): Promise<void> => {
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
      <DialogContent className="zine-tab border-2 border-[#11100D] bg-[#F4EBD8] text-[#11100D] shadow-[4px_5px_0_rgba(17,16,13,0.35),0_18px_50px_rgba(0,0,0,0.35)] sm:max-w-lg sm:rounded-[18px_6px_20px_8px]">
        <DialogHeader>
          <DialogTitle className="font-[var(--font-zine-display)] text-2xl font-black uppercase tracking-normal text-[#11100D]">
            Suggest something
          </DialogTitle>
          <DialogDescription className="sr-only">
            Submit a roadmap request for the Quiver team to review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block">
            <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-widest text-[#B56A2B]">
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
              className="mt-1 w-full rounded-[10px_3px_12px_3px] border-2 border-[#11100D]/45 bg-[#FBF6E8] px-3 py-2 text-[#11100D] placeholder:text-[#11100D]/30 focus:border-[#F78E42] focus:outline-none"
            />
          </label>

          {duplicates.length > 0 && (
            <div className="rounded-[10px_3px_12px_3px] border-2 border-[#11100D]/35 bg-[#F0E5CC] p-3">
              <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-widest text-[#11100D]/60">
                Is this what you mean?
              </p>
              <ul className="mt-2 space-y-1">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <a
                      href={`/roadmap#item-${d.id}`}
                      className="text-sm font-bold text-[#B56A2B] hover:underline"
                    >
                      {d.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="block">
            <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-widest text-[#B56A2B]">
              Description
            </span>
            <textarea
              maxLength={500}
              rows={4}
              value={description}
              aria-label="Description"
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-[10px_3px_12px_3px] border-2 border-[#11100D]/45 bg-[#FBF6E8] px-3 py-2 text-[#11100D] placeholder:text-[#11100D]/30 focus:border-[#F78E42] focus:outline-none"
            />
          </label>

          <div>
            <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-widest text-[#B56A2B]">
              Category
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`rounded-[10px_3px_12px_3px] border-2 px-3 py-1 font-[var(--font-mono)] text-xs uppercase tracking-wider transition ${
                    category === c.value
                      ? "border-[#11100D] bg-[#F78E42] text-[#11100D]"
                      : "border-[#11100D]/40 bg-[#FBF6E8] text-[#11100D]/70 hover:border-[#F78E42] hover:text-[#11100D]"
                  }` + " focus-ring"}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <p className="text-sm font-semibold text-[#B91C1C]">{errorMsg}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-[14px_6px_16px_4px] border-2 border-[#11100D] bg-[#F78E42] px-4 py-3 font-[var(--font-zine-display)] text-sm font-black uppercase tracking-wide text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.3)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 focus-ring"
          >
            {pending ? "Sending…" : "Send it"}
          </button>

          <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-[#11100D]/50">
            {"// We read every one. Live within 48h if approved, or a reply if not."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
