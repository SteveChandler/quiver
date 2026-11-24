#!/usr/bin/env python3
"""Ruler check for scripts/.hybrid-cache/recs.jsonl before any refit.

For every beach: median of replay truth / (buoy Hs ft x current bucket factor), with the bucket read
straight from beaches.shoaling_factors (saved by hybrid-replay-collect.ts), not through the transformer.
A median off 1.00 means the truth is on a different ruler from today's buckets (for example a
direction_shadow, or a cache from before a bucket change), and a k fit on it is stale.
Rows with buoy Tp at or under 8 s are left out: the transformer caps short-period buckets there.
A beach whose shoaling_factors set direction_shadow is reported but not checked: its truth carries the shadow.

Exit 1 when a beach in `--ids` (comma list, or a hybrid-k-eligible.json path) or, without --ids, any
beach is outside LO..HI.
Run: python3 scripts/hybrid-replay-ruler-check.py [--ids scripts/hybrid-k-eligible.json]
"""
import json, sys, statistics as st
from collections import defaultdict

CACHE = "scripts/.hybrid-cache"
LO, HI = 0.97, 1.03
M_TO_FT = 3.28084
SHORT_PERIOD_CUTOFF_S = 8

meta = {m["id"]: m for m in json.load(open(f"{CACHE}/beaches.json"))}
ids = None
if "--ids" in sys.argv:
    arg = sys.argv[sys.argv.index("--ids") + 1]
    ids = {b["id"] for b in json.load(open(arg))["beaches"]} if arg.endswith(".json") else set(arg.split(","))


def bucket(tp, sf):
    if not sf or sf.get("type") != "period_lookup" or tp is None or tp <= 0: return None
    return next((b["factor"] for b in sf["buckets"] if b["tp_min_s"] <= tp < b["tp_max_s"]), None)


ratios = defaultdict(list)
for line in open(f"{CACHE}/recs.jsonl"):
    if not line.strip(): continue
    r = json.loads(line)
    tp = r.get("tpTruth")
    if tp is None or tp <= SHORT_PERIOD_CUTOFF_S: continue
    f = bucket(tp, meta[r["b"]].get("shoaling_factors"))
    if not f: continue
    ratios[r["b"]].append(r["truth"] / (r["truthHs"] * M_TO_FT * f))

bad = []
for b, xs in sorted(ratios.items(), key=lambda kv: meta[kv[0]]["name"]):
    med = st.median(xs)
    shadowed = (meta[b].get("shoaling_factors") or {}).get("direction_shadow") is True
    checked = (ids is None or b in ids) and not shadowed
    flag = checked and not (LO <= med <= HI)
    if flag: bad.append(meta[b]["name"])
    print("%-34s %4s n=%5d  truth/(Hs x bucket) median %.3f%s" % (
        meta[b]["name"][:34], meta[b]["stn"], len(xs), med, "  OUT" if flag else ("" if checked else "  (shadowed, not checked)" if shadowed else "  (not checked)")))
missing = sorted(meta[b]["name"] for b in (ids or set()) if b not in ratios)
if missing: print("no Tp > 8 s rows:", ", ".join(missing))
if bad:
    print(f"\nRULER CHECK FAILED at {len(bad)} beaches ({LO}-{HI}): {', '.join(bad)}")
    sys.exit(1)
print(f"\nruler check passed: {sum(1 for b in ratios if ids is None or b in ids)} beaches inside {LO}-{HI}")
