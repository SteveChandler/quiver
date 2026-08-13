"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Check,
  Edit3,
  Loader2,
  Mail,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Trash2,
  Waves,
  Wind,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthLoader } from "@/components/ui/loading-states";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { useAuth } from "@/context/auth-context";
import { ConditionBuilder } from "@/components/alerts/condition-builder";
import type { AlertConditions, BeachAlertMeta } from "@/lib/alerts/types";

interface AlertRule {
  id: string;
  user_id: string;
  beach_id: string;
  name: string;
  preset_type: string | null;
  conditions: AlertConditions;
  notify_email: boolean;
  notify_push: boolean;
  enabled: boolean;
  last_matched_at: string | null;
  auto_created_at: string | null;
  created_at: string;
  updated_at: string;
  beaches?: {
    name: string;
    slug: string | null;
    timezone: string;
  } | null;
}

interface BeachSearchResult {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  lat?: number | null;
  lon?: number | null;
  timezone?: string | null;
}

type EditorState =
  | { mode: "create"; beach: BeachAlertMeta; rule?: undefined }
  | { mode: "edit"; beach: BeachAlertMeta; rule: AlertRule };

const LONGBOARD_CONDITIONS: AlertConditions = {
  swell_height_min: 1,
  swell_height_max: 3,
  wind_speed_max_kt: 5,
};

function getBeachName(rule: AlertRule): string {
  return rule.beaches?.name ?? "Unknown beach";
}

function toBeachAlertMeta(raw: Record<string, unknown>): BeachAlertMeta {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Beach"),
    slug: typeof raw.slug === "string" ? raw.slug : null,
    lat: typeof raw.lat === "number" ? raw.lat : 0,
    lon: typeof raw.lon === "number" ? raw.lon : 0,
    timezone: typeof raw.timezone === "string" ? raw.timezone : "UTC",
    wind_offshore_deg:
      typeof raw.wind_offshore_deg === "number" ? raw.wind_offshore_deg : null,
    wind_offshore_tol_deg:
      typeof raw.wind_offshore_tol_deg === "number"
        ? raw.wind_offshore_tol_deg
        : null,
    aspect_deg: typeof raw.aspect_deg === "number" ? raw.aspect_deg : null,
    preferred_tide_ft_min:
      typeof raw.preferred_tide_ft_min === "number"
        ? raw.preferred_tide_ft_min
        : null,
    preferred_tide_ft_max:
      typeof raw.preferred_tide_ft_max === "number"
        ? raw.preferred_tide_ft_max
        : null,
    preferred_tide_direction:
      typeof raw.preferred_tide_direction === "string"
        ? raw.preferred_tide_direction
        : null,
    swell_window_center_deg:
      typeof raw.swell_window_center_deg === "number"
        ? raw.swell_window_center_deg
        : null,
    swell_window_halfwidth_deg:
      typeof raw.swell_window_halfwidth_deg === "number"
        ? raw.swell_window_halfwidth_deg
        : null,
    break_type: typeof raw.break_type === "string" ? raw.break_type : null,
    skill_level: typeof raw.skill_level === "string" ? raw.skill_level : null,
    features: Array.isArray(raw.features)
      ? raw.features.filter((item): item is string => typeof item === "string")
      : null,
    preference_model: raw.preference_model ?? null,
    max_wind_any_mph:
      typeof raw.max_wind_any_mph === "number" ? raw.max_wind_any_mph : null,
    max_wind_onshore_mph:
      typeof raw.max_wind_onshore_mph === "number"
        ? raw.max_wind_onshore_mph
        : null,
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function fetchBeachMeta(beachId: string): Promise<BeachAlertMeta> {
  const response = await fetch(`/api/beaches/${beachId}`, {
    cache: "no-store",
  });
  const json = await readJson(response);
  if (!response.ok) {
    throw new Error(
      typeof json.message === "string" ? json.message : "Could not load beach",
    );
  }

  const payload = json.data;
  const beach =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>).beach
      : null;
  if (!beach || typeof beach !== "object") {
    throw new Error("Beach metadata was incomplete");
  }

  return toBeachAlertMeta(beach as Record<string, unknown>);
}

function formatConditionChips(conditions: AlertConditions): string[] {
  const chips: string[] = [];
  const min = conditions.swell_height_min;
  const max = conditions.swell_height_max;

  if (typeof min === "number" && typeof max === "number") {
    chips.push(`${min}-${max} ft`);
  } else if (typeof min === "number") {
    chips.push(`${min}+ ft`);
  } else if (typeof max === "number") {
    chips.push(`under ${max} ft`);
  }

  if (typeof conditions.swell_period_min === "number") {
    chips.push(`${conditions.swell_period_min}s+ period`);
  }

  if (typeof conditions.wind_speed_max_kt === "number") {
    chips.push(`<= ${conditions.wind_speed_max_kt} kt wind`);
  }

  if (conditions.wind_direction) {
    chips.push(`${conditions.wind_direction} wind`);
  }

  if (
    typeof conditions.tide_height_min_ft === "number" ||
    typeof conditions.tide_height_max_ft === "number"
  ) {
    chips.push(
      `${conditions.tide_height_min_ft ?? "low"}-${
        conditions.tide_height_max_ft ?? "high"
      } ft tide`,
    );
  }

  if (conditions.tide_direction) {
    chips.push(`${conditions.tide_direction} tide`);
  }

  return chips.length ? chips : ["custom conditions"];
}

function groupRulesByBeach(rules: AlertRule[]): Array<{
  beachId: string;
  beachName: string;
  rules: AlertRule[];
}> {
  const groups = new Map<string, { beachName: string; rules: AlertRule[] }>();

  for (const rule of rules) {
    const existing = groups.get(rule.beach_id);
    if (existing) {
      existing.rules.push(rule);
      continue;
    }
    groups.set(rule.beach_id, {
      beachName: getBeachName(rule),
      rules: [rule],
    });
  }

  return Array.from(groups.entries())
    .map(([beachId, group]) => ({ beachId, ...group }))
    .sort((a, b) => a.beachName.localeCompare(b.beachName));
}

function validateConditions(conditions: AlertConditions): string | null {
  if (
    typeof conditions.swell_height_min === "number" &&
    typeof conditions.swell_height_max === "number" &&
    conditions.swell_height_min > conditions.swell_height_max
  ) {
    return "Minimum wave height must be below the maximum.";
  }

  if (
    typeof conditions.tide_height_min_ft === "number" &&
    typeof conditions.tide_height_max_ft === "number" &&
    conditions.tide_height_min_ft > conditions.tide_height_max_ft
  ) {
    return "Minimum tide height must be below the maximum.";
  }

  return null;
}

export function AlertsManagementPage() {
  const { user, isLoading } = useAuth();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [beachResults, setBeachResults] = useState<BeachSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  const conditionRules = useMemo(
    () => rules.filter((rule) => rule.preset_type !== "similarity_match"),
    [rules],
  );
  const groupedRules = useMemo(
    () => groupRulesByBeach(conditionRules),
    [conditionRules],
  );

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const response = await fetch("/api/alerts/rules", { cache: "no-store" });
      const json = await readJson(response);
      if (!response.ok) {
        throw new Error(
          typeof json.message === "string"
            ? json.message
            : "Could not load alerts",
        );
      }
      setRules((json.data as AlertRule[]) ?? []);
    } catch (error) {
      setRulesError(
        error instanceof Error ? error.message : "Could not load alerts",
      );
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadRules();
  }, [loadRules, user]);

  useEffect(() => {
    const query = searchQuery.trim();
    searchAbortRef.current?.abort();

    if (query.length < 2) {
      setBeachResults([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(
          `/api/beaches/search?query=${encodeURIComponent(query)}&limit=8`,
          { signal: controller.signal },
        );
        const json = await readJson(response);
        if (!response.ok) throw new Error("search failed");
        setBeachResults((json.data as BeachSearchResult[]) ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setBeachResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const openCreateEditor = async (beachId: string) => {
    setEditorLoading(true);
    try {
      const beach = await fetchBeachMeta(beachId);
      setEditor({ mode: "create", beach });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load beach",
      );
    } finally {
      setEditorLoading(false);
    }
  };

  const openEditEditor = async (rule: AlertRule) => {
    setEditorLoading(true);
    try {
      const beach = await fetchBeachMeta(rule.beach_id);
      setEditor({ mode: "edit", beach, rule });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load beach",
      );
    } finally {
      setEditorLoading(false);
    }
  };

  const patchRule = async (
    ruleId: string,
    updates: Record<string, unknown>,
  ) => {
    const response = await fetch(`/api/alerts/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const json = await readJson(response);
    if (!response.ok) {
      throw new Error(
        typeof json.message === "string"
          ? json.message
          : "Could not update alert",
      );
    }
    await loadRules();
  };

  const handleToggleRule = async (rule: AlertRule) => {
    setRules((prev) =>
      prev.map((item) =>
        item.id === rule.id ? { ...item, enabled: !item.enabled } : item,
      ),
    );
    try {
      await patchRule(rule.id, { enabled: !rule.enabled });
      toast.success(!rule.enabled ? "Alert enabled" : "Alert paused");
    } catch (error) {
      setRules((prev) =>
        prev.map((item) =>
          item.id === rule.id ? { ...item, enabled: rule.enabled } : item,
        ),
      );
      toast.error(
        error instanceof Error ? error.message : "Could not update alert",
      );
    }
  };

  const handleDeleteRule = async (rule: AlertRule) => {
    const confirmed = window.confirm(`Delete "${rule.name}"?`);
    if (!confirmed) return;

    const previous = rules;
    setRules((prev) => prev.filter((item) => item.id !== rule.id));
    try {
      const response = await fetch(`/api/alerts/rules/${rule.id}`, {
        method: "DELETE",
      });
      const json = await readJson(response);
      if (!response.ok) {
        throw new Error(
          typeof json.message === "string"
            ? json.message
            : "Could not delete alert",
        );
      }
      toast.success("Alert deleted");
    } catch (error) {
      setRules(previous);
      toast.error(
        error instanceof Error ? error.message : "Could not delete alert",
      );
    }
  };

  if (isLoading) {
    return <AuthLoader />;
  }

  if (!user) {
    return (
      <ZineSurface
        sectionLabel="Condition alerts"
        editionLabel="Account required"
        data-testid="alerts-auth-required"
        paperClassName="overflow-hidden"
      >
        <main className="mx-auto max-w-2xl space-y-6 py-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center border-2 border-ink bg-q-orange shadow-[4px_4px_0_var(--ink)]">
            <Radio className="h-7 w-7 text-ink" aria-hidden="true" />
          </div>
          <div className="space-y-3">
            <p className="label-black">Surf watch desk</p>
            <h1 className="zine-h1 font-black uppercase leading-[0.9] tracking-normal text-ink">
              Sign in for condition alerts
            </h1>
            <p className="mx-auto max-w-xl text-base leading-7 text-[#3B352C]">
              Condition alerts need an account so Quiver can save your surf
              windows and send the right notifications.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="border-2 border-ink bg-q-orange font-black uppercase text-ink shadow-[4px_4px_0_var(--ink)] hover:bg-q-orange/90"
            >
              <Link href="/auth/sign-in?redirectTo=/alerts">Sign in</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-2 border-ink bg-[#F4E7D1] font-black uppercase text-ink shadow-[4px_4px_0_var(--ink)] hover:bg-[#F4E7D1]/90"
            >
              <Link href="/auth/sign-up?redirectTo=/alerts">Create account</Link>
            </Button>
          </div>
        </main>
      </ZineSurface>
    );
  }

  return (
    <ZineSurface
      sectionLabel="Condition alerts"
      editionLabel="Saved surf windows"
      data-testid="alerts-zine-surface"
      paperClassName="overflow-hidden"
    >
      <style>
        {`
          .theme-retro-dark .zine-alert-input {
            background-color: var(--paper) !important;
            color: var(--ink) !important;
          }

          .theme-retro-dark .zine-alert-control {
            background-color: var(--paper) !important;
            color: var(--ink) !important;
          }
        `}
      </style>
      <main className="space-y-7">
        <section className="relative border-b-2 border-ink pb-7">
          <QuiverSticker
            sticker="orangeTape"
            className="absolute -right-6 -top-8 hidden w-32 rotate-6 opacity-85 sm:block"
          />
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="label-black mb-4">Surf watch desk</p>
              <h1 className="zine-h1 font-black uppercase leading-[0.9] tracking-normal text-ink">
                Condition alerts
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-ink/75 sm:text-lg">
                Manage the surf windows you care about. These rules use wave
                height, wind, tide, and beach-specific forecast data.
              </p>
            </div>
            <Button
              type="button"
              onClick={() =>
                document.getElementById("alert-beach-search")?.focus()
              }
              className="h-11 rounded-full border-2 border-ink bg-q-orange px-5 font-semibold text-ink shadow-[2px_2px_0_rgba(17,16,13,0.35)] hover:bg-q-orange/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create alert
            </Button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="torn torn-tb rotate-[-0.35deg] border-2 border-ink bg-[#FBF6E8] p-5 shadow-[5px_6px_0_rgba(17,16,13,0.22)]">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-q-orange" />
              <h2 className="font-[family-name:var(--font-space-grotesk)] text-base font-black uppercase tracking-[0.03em] text-ink">
                Create for a beach
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#403A2E]">
              Start with the small clean longboard setup, then adjust the
              conditions before saving.
            </p>
            <div className="mt-4">
              <label htmlFor="alert-beach-search" className="sr-only">
                Search beaches
              </label>
              <input
                id="alert-beach-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search Bolsa, Huntington..."
                  className="zine-alert-input h-11 w-full rounded-sm border-2 border-ink bg-paper px-3 text-sm text-ink outline-none placeholder:text-[#5F5646] focus:border-q-orange focus:ring-2 focus:ring-q-orange/30"
              />
            </div>

            <div className="mt-3 space-y-2" data-testid="alert-beach-results">
              {searchLoading || editorLoading ? (
                <div className="flex items-center gap-2 rounded-sm border-2 border-ink/45 bg-paper px-3 py-3 text-sm text-[#403A2E]">
                  <Loader2 className="h-4 w-4 animate-spin text-q-orange" />
                  Loading beach metadata
                </div>
              ) : null}

              {!searchLoading &&
              searchQuery.trim().length >= 2 &&
              beachResults.length === 0 ? (
                <div className="rounded-sm border-2 border-dashed border-ink/45 bg-paper px-3 py-3 text-sm text-[#403A2E]">
                  No beaches found
                </div>
              ) : null}

              {beachResults.map((beach) => (
                <button
                  key={beach.id}
                  type="button"
                  onClick={() => openCreateEditor(beach.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-sm border-2 border-ink bg-paper px-3 py-3 text-left text-ink shadow-[2px_2px_0_rgba(17,16,13,0.18)] transition hover:-translate-y-0.5 hover:bg-[#FFF9EA] hover:shadow-[3px_3px_0_rgba(17,16,13,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-q-orange/70"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">
                      {beach.name}
                    </span>
                    <span className="block truncate text-xs text-[#403A2E]">
                      {[beach.city, beach.state].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-q-orange" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {rulesError ? (
              <Alert className="border-2 border-red-700 bg-red-50 text-red-900">
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>{rulesError}</span>
                  <button
                    type="button"
                    onClick={loadRules}
                    className="inline-flex items-center gap-1 text-sm font-black text-red-900 focus-ring"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </AlertDescription>
              </Alert>
            ) : null}

            {rulesLoading ? (
              <div className="rounded-sm border-2 border-ink bg-[#FBF6E8] p-8 text-center text-[#403A2E] shadow-[4px_5px_0_rgba(17,16,13,0.18)]">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-q-orange" />
                Loading alerts
              </div>
            ) : null}

            {!rulesLoading && groupedRules.length === 0 ? (
              <div className="rounded-sm border-2 border-dashed border-ink bg-[#FBF6E8] p-8 text-center text-ink shadow-[4px_5px_0_rgba(17,16,13,0.14)]">
                <Waves className="mx-auto h-8 w-8 text-q-orange" />
                <h2 className="mt-3 font-[family-name:var(--font-space-grotesk)] text-xl font-black uppercase">
                  No condition alerts yet
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#403A2E]">
                  Search for a beach and create a rule for small clean waves,
                  glassy mornings, tide windows, or your own setup.
                </p>
              </div>
            ) : null}

            {groupedRules.map((group) => (
              <section
                key={group.beachId}
                className="rounded-sm border-2 border-ink bg-[#FBF6E8] p-4 text-ink shadow-[4px_5px_0_rgba(17,16,13,0.18)]"
              >
                <div className="flex flex-col gap-2 border-b-2 border-ink pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-[family-name:var(--font-space-grotesk)] text-lg font-black uppercase tracking-[0.03em]">
                      {group.beachName}
                    </h2>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#403A2E]">
                      {group.rules.length} alert
                      {group.rules.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreateEditor(group.beachId)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-ink bg-paper px-3 text-sm font-black text-ink shadow-[2px_2px_0_rgba(17,16,13,0.18)] transition hover:-translate-y-0.5 hover:bg-q-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-q-orange/70"
                  >
                    <Plus className="h-4 w-4" />
                    Add rule
                  </button>
                </div>

                <div className="divide-y-2 divide-ink/20">
                  {group.rules.map((rule) => (
                    <AlertRuleRow
                      key={rule.id}
                      rule={rule}
                      onToggle={() => handleToggleRule(rule)}
                      onDelete={() => handleDeleteRule(rule)}
                      onEdit={() => openEditEditor(rule)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>

      <AlertRuleEditorDialog
        editor={editor}
        onClose={() => setEditor(null)}
        onSaved={async () => {
          setEditor(null);
          await loadRules();
        }}
      />
    </ZineSurface>
  );
}

function AlertRuleRow({
  rule,
  onToggle,
  onDelete,
  onEdit,
}: {
  rule: AlertRule;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const chips = formatConditionChips(rule.conditions ?? {});

  return (
    <article
      className="grid gap-3 py-4 md:grid-cols-[1fr_auto]"
      data-testid={`alert-rule-${rule.id}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-black text-ink">
            {rule.name}
          </h3>
          <span
            className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] ${
              rule.enabled
                ? "border-ink bg-q-orange text-ink"
                : "border-ink/35 bg-[#E6E0D1] text-[#403A2E]"
            }`}
          >
            {rule.enabled ? "Active" : "Paused"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-sm border border-ink/35 bg-[#FFF9EA] px-2.5 py-1 font-mono text-[11px] font-bold text-q-twilight"
            >
              {chip}
            </span>
          ))}
          {rule.notify_push ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-ink/45 bg-q-orange/20 px-2.5 py-1 font-mono text-[11px] font-bold text-ink">
              <Radio className="h-3 w-3" />
              Push on
            </span>
          ) : null}
          {rule.notify_email ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-ink/35 bg-paper px-2.5 py-1 font-mono text-[11px] font-bold text-[#403A2E]">
              <Mail className="h-3 w-3" />
              Email on
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          aria-label={rule.enabled ? "Pause alert" : "Enable alert"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-[#403A2E] transition hover:bg-q-orange/20 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-q-orange/70"
        >
          {rule.enabled ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit alert"
          className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-[#403A2E] transition hover:bg-q-orange/20 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-q-orange/70"
        >
          <Edit3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete alert"
          className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-[#403A2E] transition hover:bg-red-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function AlertRuleEditorDialog({
  editor,
  onClose,
  onSaved,
}: {
  editor: EditorState | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [conditions, setConditions] =
    useState<AlertConditions>(LONGBOARD_CONDITIONS);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    if (editor.mode === "edit") {
      setName(editor.rule.name);
      setConditions(editor.rule.conditions ?? {});
      setNotifyPush(editor.rule.notify_push);
      setNotifyEmail(editor.rule.notify_email);
      setError(null);
      return;
    }

    setName(`Small clean longboard waves - ${editor.beach.name}`);
    setConditions(LONGBOARD_CONDITIONS);
    setNotifyPush(true);
    setNotifyEmail(false);
    setError(null);
  }, [editor]);

  const hasConditions = Object.keys(conditions).length > 0;

  const handleSave = async () => {
    if (!editor || saving) return;
    if (!name.trim()) {
      setError("Name this alert before saving.");
      return;
    }
    if (!hasConditions) {
      setError("Add at least one condition.");
      return;
    }
    const conditionError = validateConditions(conditions);
    if (conditionError) {
      setError(conditionError);
      return;
    }
    if (!notifyPush && !notifyEmail) {
      setError("Choose push, email, or both.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        conditions,
        notify_push: notifyPush,
        notify_email: notifyEmail,
      };
      const response =
        editor.mode === "edit"
          ? await fetch(`/api/alerts/rules/${editor.rule.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
          : await fetch("/api/alerts/rules", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...body,
                beach_id: editor.beach.id,
                preset_type: null,
              }),
            });

      const json = await readJson(response);
      if (!response.ok) {
        throw new Error(
          typeof json.message === "string" || typeof json.error === "string"
            ? String(json.message ?? json.error)
            : "Could not save alert",
        );
      }
      toast.success(editor.mode === "edit" ? "Alert updated" : "Alert created");
      await onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save alert",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!editor} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent
        data-testid="alert-editor-dialog"
        className="max-w-lg overflow-hidden rounded-sm border-2 border-ink bg-paper p-0 text-ink shadow-[8px_8px_0_rgba(17,16,13,0.55)] [&>button]:text-ink [&>button]:opacity-100 [&>button]:ring-offset-paper"
      >
        {editor ? (
          <>
            <DialogHeader className="border-b-2 border-ink bg-[#FBF6E8] px-5 py-4">
              <DialogTitle className="font-[family-name:var(--font-space-grotesk)] text-lg font-black uppercase tracking-[0.03em]">
                {editor.mode === "edit" ? "Edit alert" : "Create alert"}
              </DialogTitle>
              <DialogDescription className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#403A2E]">
                {editor.beach.name}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[74vh] space-y-4 overflow-y-auto px-5 py-5">
              <div className="rounded-sm border-2 border-ink bg-[#FFF9EA] p-3 shadow-[2px_2px_0_rgba(17,16,13,0.18)]">
                <div className="flex items-center gap-2 text-sm font-black text-ink">
                  <Waves className="h-4 w-4" />
                  Small clean longboard default
                </div>
                <p className="mt-1 text-xs leading-5 text-[#403A2E]">
                  Starts at 1-3 ft and light wind. Adjust anything before
                  saving.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="alert-name"
                  className="font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[#403A2E]"
                >
                  Alert name
                </label>
                <input
                  id="alert-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  className="zine-alert-control h-10 w-full rounded-sm border-2 border-ink bg-[#FBF6E8] px-3 text-sm text-ink outline-none focus:border-q-orange focus:ring-2 focus:ring-q-orange/30"
                />
              </div>

              <div
                className="space-y-1.5"
                role="group"
                aria-labelledby="alert-conditions-label"
              >
                <span
                  id="alert-conditions-label"
                  className="block font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[#403A2E]"
                >
                  Conditions
                </span>
                <ConditionBuilder
                  conditions={conditions}
                  onChange={setConditions}
                />
              </div>

              <div
                className="space-y-2"
                role="group"
                aria-labelledby="alert-notify-label"
              >
                <span
                  id="alert-notify-label"
                  className="block font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[#403A2E]"
                >
                  Notify via
                </span>
                <div className="flex flex-wrap gap-2">
                  <ChannelButton
                    active={notifyPush}
                    onClick={() => setNotifyPush((prev) => !prev)}
                    icon={<Radio className="h-3.5 w-3.5" />}
                    label="Push"
                  />
                  <ChannelButton
                    active={notifyEmail}
                    onClick={() => setNotifyEmail((prev) => !prev)}
                    icon={<Mail className="h-3.5 w-3.5" />}
                    label="Email"
                  />
                </div>
              </div>

              {error ? (
                <Alert className="border-2 border-red-700 bg-red-50 text-red-900">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                data-testid="alert-editor-save"
                className="h-11 w-full rounded-full border-2 border-ink bg-q-orange font-black text-ink shadow-[2px_2px_0_rgba(17,16,13,0.35)] hover:bg-q-orange/90 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {editor.mode === "edit" ? "Save changes" : "Create alert"}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ChannelButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border-2 px-3 text-xs font-black transition ${
        active
          ? "border-ink bg-q-orange text-ink"
          : "border-ink/45 bg-[#FBF6E8] text-[#403A2E] hover:border-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
