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
          <DialogTitle>Suggest something</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-slate-400">Title</span>
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
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>

          {duplicates.length > 0 && (
            <div className="rounded border border-slate-800 bg-slate-900/40 p-3">
              <p className="text-xs text-slate-400">Is this what you mean?</p>
              <ul className="mt-2 space-y-1">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <a
                      href={`/roadmap#item-${d.id}`}
                      className="text-sm text-orange-400 hover:underline"
                    >
                      {d.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="block">
            <span className="text-sm text-slate-400">Description</span>
            <textarea
              maxLength={500}
              rows={4}
              value={description}
              aria-label="Description"
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>

          <div>
            <span className="text-sm text-slate-400">Category</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    category === c.value
                      ? "border-orange-500 bg-orange-500/10 text-orange-400"
                      : "border-slate-700 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <p className="text-sm text-rose-400">{errorMsg}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded bg-orange-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send it"}
          </button>

          <p className="text-xs text-slate-500">
            We read every one. You&apos;ll see it live within 48h if approved, or a reply if not.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
