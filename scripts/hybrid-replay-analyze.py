#!/usr/bin/env python3
"""Scores scripts/.hybrid-cache/recs.jsonl (from hybrid-replay-collect.ts).

Methods, all scored on the same rows:
  prod    current main transform with the shipped per-beach factor (in-sample: fit on these 30 days)
  refit   uncalibrated transform x per-beach k fit on the training weeks
  hyb*    MFWAM partitions x r (r = ECMWF total Hs / MF total Hs), transform, x per-beach k fit the same way
k rule = shippedFactor in replay-model-swell-calibration.ts: median(truth/model), >= 50 training rows,
clamp [0.8, 2.5] (station 215 capped at 1.6), |k-1| < 0.08 -> 1. k is fit on 0-24 h rows only, like production.
Splits: leave-one-ISO-week-out (by valid time) and leave-one-beach-out (k = median k of the other beaches on the
same CDIP station, else of all other beaches).
Run: python3 scripts/hybrid-replay-analyze.py [--json out.json]
"""
import json, sys, statistics as st, datetime as dt
from collections import defaultdict

CACHE = "scripts/.hybrid-cache"
RECS = next((a for a in sys.argv[1:] if a.endswith(".jsonl")), f"{CACHE}/recs.jsonl")
recs = [json.loads(l) for l in open(RECS) if l.strip()]
meta = {m["id"]: m for m in json.load(open(f"{CACHE}/beaches.json"))}
METHODS = ["hyb", "hybCap", "hybRss", "hybRssCap", "hybOpt"]
# The r each hybrid method used. A row with no r (no ECMWF value) is the production path live,
# so it is left out of every hybrid k fit and scored with the production factor.
R_KEY = {"hyb": "r", "hybCap": "r", "hybRss": "rRss", "hybRssCap": "rRss", "hybOpt": "rOpt"}


def lead_bin(lead):
    # the log's horizon bands end exactly at 24/72/168 h, and issue time trails the run hour by < 0.3 h
    if lead <= 24.5: return "0-24h"
    if lead <= 72.5: return "1-3d"
    if lead <= 120.5: return "3-5d"
    return "5-7d"


for r in recs:
    r["bin"] = lead_bin(r["lead"])
    d = dt.datetime.fromisoformat(r["at"].replace("Z", "+00:00"))
    r["wk"] = "%d-W%02d" % d.isocalendar()[:2]


def rule(ratios, min_rows=50, cap=2.5):
    if len(ratios) < min_rows: return 1.0
    k = min(cap, max(0.8, st.median(ratios)))
    return round(k, 2) if abs(k - 1) >= 0.08 else 1.0


def cap_for(stn): return 1.6 if stn == "215" else 2.5


MIN_ROWS = 20 if "archive" in RECS else 50


def fit(rows, key):
    if key in R_KEY: rows = [r for r in rows if r[R_KEY[key]] is not None]
    return rule([r["truth"] / r[key] for r in rows if r[key] > 0], min_rows=MIN_ROWS, cap=cap_for(rows[0]["stn"]) if rows else 2.5)


by_beach = defaultdict(list)
for r in recs: by_beach[r["b"]].append(r)
weeks = sorted({r["wk"] for r in recs})

# ---- week-block CV: predictions per row
for b, rows in by_beach.items():
    for w in weeks:
        train = [r for r in rows if r["wk"] != w and r["bin"] == "0-24h"]
        test = [r for r in rows if r["wk"] == w]
        if not test: continue
        k_ref = fit(train, "uncal") if train else 1.0
        k_unheld = rule([r["truth"] / r["uncal"] for r in train], min_rows=MIN_ROWS) if train else 1.0
        ks = {m: (fit(train, m) if train else 1.0) for m in METHODS}
        for r in test:
            r["p_refit"] = r["uncal"] * k_ref
            r["p_refitUnheld"] = r["uncal"] * k_unheld
            for m in METHODS: r["p_" + m] = r[m] * ks[m] if r[R_KEY[m]] is not None else r["prod"]

# ---- beach hold-out: per-beach k fit on all weeks (0-24 h), then borrowed from other beaches
k_all = {}
for b, rows in by_beach.items():
    d1 = [r for r in rows if r["bin"] == "0-24h"]
    k_all[b] = {m: fit(d1, m) if d1 else 1.0 for m in ["uncal"] + METHODS}
for b, rows in by_beach.items():
    stn = rows[0]["stn"]
    peers = [o for o in by_beach if o != b and by_beach[o][0]["stn"] == stn] or [o for o in by_beach if o != b]
    for m in ["uncal"] + METHODS:
        k = st.median([k_all[o][m] for o in peers])
        for r in rows: r["bh_" + m] = r[m] * k if m not in R_KEY or r[R_KEY[m]] is not None else r["prod"]

PRED = {"prod": lambda r: r["prod"], "refit": lambda r: r["p_refit"], "hybrid": lambda r: r["p_hyb"],
        "refit-unheld215": lambda r: r["p_refitUnheld"],
        "hybrid-cap0.5-2": lambda r: r["p_hybCap"], "hybrid-RSSbasis": lambda r: r["p_hybRss"],
        "hybrid-RSS-cap0.5-2": lambda r: r["p_hybRssCap"],
        "hybrid-fresherEC": lambda r: r["p_hybOpt"], "logged(then)": lambda r: r["logged"],
        "uncalibrated": lambda r: r["uncal"],
        "BH-refit": lambda r: r["bh_uncal"], "BH-hybrid": lambda r: r["bh_hyb"]}
BINS = ["0-24h", "1-3d", "3-5d", "5-7d"]


def mae(rows, f): return sum(abs(r["truth"] - f(r)) for r in rows) / len(rows) if rows else float("nan")
def bias(rows, f): return sum(f(r) - r["truth"] for r in rows) / len(rows) if rows else float("nan")


scored = [r for r in recs if "p_refit" in r]
print(f"rows {len(scored)}  beaches {len(by_beach)}  weeks {weeks}")
print("\nFace MAE ft (bias) by lead bin; held out by ISO week. BH = beach hold-out k.")
hdr = "%-18s" % "method" + "".join("%22s" % (b + " all") + "%22s" % (b + " >=4ft") for b in BINS)
print(hdr)
counts = "%-18s" % "n" + "".join("%22d%22d" % (len([r for r in scored if r["bin"] == b]),
                                              len([r for r in scored if r["bin"] == b and r["truth"] >= 4])) for b in BINS)
print(counts)
summary = {}
for name, f in PRED.items():
    line = "%-18s" % name
    for b in BINS:
        for big in (False, True):
            rows = [r for r in scored if r["bin"] == b and (r["truth"] >= 4 or not big)]
            m, bi = mae(rows, f), bias(rows, f)
            summary[(name, b, big)] = (m, bi, len(rows))
            line += "%22s" % ("%.2f (%+.2f)" % (m, bi) if rows else "-")
    print(line)
for big in (False, True):
    rows = [r for r in scored if (r["truth"] >= 4 or not big)]
    print("ALL leads %s n=%d: " % (">=4ft" if big else "all", len(rows)) +
          "  ".join("%s %.2f" % (n, mae(rows, f)) for n, f in PRED.items()))

# ---- per-beach wins
print("\nPer-beach wins (beach MAE, beaches with >=30 rows in the bin)")
for b in BINS:
    w = defaultdict(int); tot = 0
    for bid, rows in by_beach.items():
        rr = [r for r in rows if r["bin"] == b and "p_refit" in r]
        if len(rr) < 30: continue
        tot += 1
        mp, mr, mh = mae(rr, PRED["prod"]), mae(rr, PRED["refit"]), mae(rr, PRED["hybrid"])
        w["hyb<prod"] += mh < mp; w["hyb<refit"] += mh < mr; w["refit<prod"] += mr < mp
        w["hyb best of 3"] += mh < min(mp, mr)
    print(f"  {b}: beaches {tot}  " + "  ".join(f"{k} {v}" for k, v in w.items()))

# ---- per-beach table
print("\nPer beach, 0-24h and 5-7d: MAE prod / refit / hybrid; cell km; r median; ECMWF null share")
lines = []
for bid, rows in by_beach.items():
    m = meta.get(bid, {})
    rr = [r for r in rows if "p_refit" in r]
    rs = [r["r"] for r in rr if r["r"] is not None]
    nulls = sum(r["r"] is None for r in rr) / len(rr) if rr else 0
    cells = []
    for b in (("0-24h", "1-3d", "3-5d", "5-7d") if "archive" in RECS else ("0-24h", "1-3d", "5-7d")):
        x = [r for r in rr if r["bin"] == b]
        cells.append("%4.2f/%4.2f/%4.2f" % (mae(x, PRED["prod"]), mae(x, PRED["refit"]), mae(x, PRED["hybrid"])) if x else "      -       ")
    lines.append((m.get("name", bid)[:30], rows[0]["stn"], len(rr), cells, m.get("cellKm", float("nan")),
                  st.median(rs) if rs else float("nan"), nulls, k_all[bid]))
for name, stn, n, cells, km, rmed, nulls, ks in sorted(lines, key=lambda x: x[1] + x[0]):
    print("%-30s %4s %5d  %s  cell %5.1f km  r %.2f  null %3.0f%%  k uncal %.2f hyb %.2f rss %.2f" %
          (name, stn, n, "  ".join(cells), km, rmed, nulls * 100, ks["uncal"], ks["hyb"], ks["hybRss"]))

# ---- period
print("\nPeriod MAE s vs CDIP Tp (rows with all three)")
for b in BINS:
    rr = [r for r in scored if r["bin"] == b and r["tpTruth"] and r["tpProd"] and r["tpEc"]]
    if not rr: continue
    f = lambda k: sum(abs(r[k] - r["tpTruth"]) for r in rr) / len(rr)
    print(f"  {b} n={len(rr)}: production period (MF dominant partition) {f('tpProd'):.2f}  ECMWF peak {f('tpEc'):.2f}" +
          (f"  MF peak {f('tpMf'):.2f}" if all(r['tpMf'] for r in rr) else ""))

# ---- r distribution and nulls
rs = [r["r"] for r in scored if r["r"] is not None]
print("\nr = ECMWF Hs / MF Hs: n %d  p5 %.2f  p25 %.2f  median %.2f  p75 %.2f  p95 %.2f ; null/zero rows %d (%.1f%%)" % (
    len(rs), *[sorted(rs)[int(q * (len(rs) - 1))] for q in (0.05, 0.25, 0.5, 0.75, 0.95)],
    len(scored) - len(rs), 100 * (len(scored) - len(rs)) / len(scored)))
print("\nSkipped beaches:")
for m in meta.values():
    if m.get("skipped"): print("  ", m["name"], m["stn"], m["skipped"], m.get("buoyKm"))

if "--json" in sys.argv:
    json.dump({"%s|%s|%s" % k: v for k, v in summary.items()}, open(sys.argv[sys.argv.index("--json") + 1], "w"), indent=1)
